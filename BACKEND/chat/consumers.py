import json
import logging
from datetime import date, datetime
from urllib.parse import parse_qs
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from utils.database import DatabaseManager

logger = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 5000


class ChatInputError(Exception):
    """Bad client input; the message is safe to show to the client."""


class ChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time chat functionality.
    
    Handles WebSocket connections for one-on-one messaging with features:
    - JWT-based authentication via query string
    - Real-time message sending/receiving
    - Typing indicators
    - Read receipts
    - Media (image) support in messages
    
    WebSocket URL: ws://localhost:8000/ws/chat/?token=<JWT_ACCESS_TOKEN>
    
    Message Types:
        - chat_message: Send/receive messages
        - typing: Send/receive typing indicators
        - read_message: Mark messages as read
    
    Attributes:
        user: Authenticated user object
        user_id: String representation of user ID
        room_group_name: Channel layer group name for user
    """
    async def connect(self):
        """
        Handle WebSocket connection request.
        
        Authenticates user via JWT token from query string, joins user to their
        personal channel group, and sends connection confirmation.
        
        Flow:
            1. Extract and validate JWT token from query string
            2. Get user from database
            3. Join user to channel group
            4. Accept connection
            5. Send connection confirmation message
        
        Closes connection if authentication fails.
        """
        self.user = await self.get_user_from_token()
        
        if self.user is None or isinstance(self.user, AnonymousUser):
            await self.close()
            return
        
        self.user_id = str(self.user.id)
        self.room_group_name = f'user_{self.user_id}'
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send connection success message
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': 'Connected to chat server'
        }))
    
    async def disconnect(self, close_code): # type: ignore
        """
        Handle WebSocket disconnection.
        
        Removes user from their channel group to stop receiving messages.
        
        Args:
            close_code: WebSocket close code indicating reason for disconnection
        """
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
    
    async def receive(self, text_data): # type: ignore
        """
        Receive and route incoming WebSocket messages.
        
        Parses JSON data and routes to appropriate handler based on message type.
        
        Args:
            text_data: JSON string containing message data
        
        Expected JSON format:
            {
                "type": "chat_message|typing|read_message",
                "receiver_id": int,
                "content": str (optional),
                "media_url": str (optional),
                "is_typing": bool (for typing),
                "message_id": int (for read_message)
            }
        
        Sends error message if parsing or handling fails.
        """
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'chat_message':
                await self.handle_chat_message(data)
            elif message_type == 'typing':
                await self.handle_typing(data)
            elif message_type == 'read_message':
                await self.handle_read_message(data)
                
        except ChatInputError as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))
        except Exception:
            logger.exception('Chat WebSocket handler failed')
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Something went wrong'
            }))
    
    async def handle_chat_message(self, data):
        """
        Process and deliver chat message to recipient.
        
        Saves message to database and broadcasts to receiver's channel group.
        
        Args:
            data (dict): Message data containing:
                - receiver_id (int): ID of message recipient
                - content (str): Message text content
                - media_url (str, optional): URL of attached image
        
        Flow:
            1. Extract receiver_id, content, and media_url from data
            2. Save message to messages table
            3. Send message to receiver's channel group
            4. Send confirmation to sender
        
        Returns early if receiver_id is missing.
        """
        receiver_id = self.parse_user_id(data.get('receiver_id'))
        content = data.get('content') or ''
        if not isinstance(content, str):
            raise ChatInputError('Invalid message')
        content = content.strip()
        if len(content) > MAX_MESSAGE_LENGTH:
            raise ChatInputError('Message is too long')
        media_url = data.get('media_url')
        if media_url is not None and (
            not isinstance(media_url, str)
            or len(media_url) > 500
            or not media_url.startswith(('https://', 'http://', '/'))
        ):
            raise ChatInputError('Invalid media URL')
        if receiver_id is None or receiver_id == self.user.id:
            return

        if not content and not media_url:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Message cannot be empty'
            }))
            return

        if not await self.can_user_message(self.user.id, receiver_id):
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Messaging not allowed'
            }))
            return

        if not await self.user_exists(receiver_id):
            raise ChatInputError('Recipient not found')
        
        message = await self.save_message(
            sender_id=self.user.id, # type: ignore
            receiver_id=receiver_id,
            content=content,
            media_url=media_url
        )
        
        await self.channel_layer.group_send(
            f'user_{receiver_id}',
            {
                'type': 'chat_message',
                'message': message
            }
        )
        

        await self.send(text_data=json.dumps({
            'type': 'message_sent',
            'message': message
        }))
    
    async def handle_typing(self, data):
        """
        Broadcast typing indicator to recipient.
        
        Notifies receiver when sender starts/stops typing.
        
        Args:
            data (dict): Typing data containing:
                - receiver_id (int): ID of user to notify
                - is_typing (bool): True if typing, False if stopped
        
        The receiver will receive:
            {
                "type": "typing",
                "sender_id": int,
                "is_typing": bool
            }
        """
        receiver_id = self.parse_user_id(data.get('receiver_id'))
        is_typing = bool(data.get('is_typing', False))

        if receiver_id is None or receiver_id == self.user.id:
            return

        if not await self.can_user_message(self.user.id, receiver_id):
            return
        
        await self.channel_layer.group_send(
            f'user_{receiver_id}',
            {
                'type': 'typing_indicator',
                'sender_id': self.user.id, # type: ignore
                'is_typing': is_typing
            }
        )
    
    async def handle_read_message(self, data):
        """
        Mark message as read and notify sender.
        
        Updates message read status in database and notifies original sender.
        
        Args:
            data (dict): Read receipt data containing:
                - message_id (int): ID of message to mark as read
                - sender_id (int): ID of original sender to notify
        
        Flow:
            1. Update message is_read field to TRUE
            2. Notify sender's channel group
        """
        message_id = self.parse_user_id(data.get('message_id'))
        if message_id is None:
            return

        sender_id = await self.mark_message_as_read(message_id, self.user.id)
        if sender_id:
            await self.channel_layer.group_send(
                f'user_{sender_id}',
                {
                    'type': 'message_read',
                    'message_id': message_id
                }
            )

    async def chat_message(self, event):
        """
        Channel layer event handler for incoming chat messages.
        
        Receives message from channel group and sends to WebSocket.
        
        Args:
            event (dict): Channel layer event containing:
                - type: "chat_message"
                - message: Complete message object from database
        
        Sends to WebSocket:
            {
                "type": "chat_message",
                "message": {...message data...}
            }
        """
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message']
        }))
    
    async def typing_indicator(self, event):
        """
        Channel layer event handler for typing indicators.
        
        Receives typing status from channel group and sends to WebSocket.
        
        Args:
            event (dict): Channel layer event containing:
                - type: "typing_indicator"
                - sender_id: ID of user typing
                - is_typing: Boolean typing status
        """
        await self.send(text_data=json.dumps({
            'type': 'typing',
            'sender_id': event['sender_id'],
            'is_typing': event['is_typing']
        }))
    
    async def message_read(self, event):
        """
        Channel layer event handler for read receipts.
        
        Receives read receipt from channel group and sends to WebSocket.
        
        Args:
            event (dict): Channel layer event containing:
                - type: "message_read"
                - message_id: ID of message that was read
        """
        await self.send(text_data=json.dumps({
            'type': 'message_read',
            'message_id': event['message_id']
        }))
    
    @staticmethod
    def parse_user_id(value):
        """Positive int or None (bool / floats / strings with junk are rejected)."""
        if isinstance(value, bool):
            return None
        try:
            number = int(str(value).strip())
        except (TypeError, ValueError):
            return None
        return number if number > 0 else None

    @database_sync_to_async
    def user_exists(self, user_id):
        return bool(DatabaseManager.execute_query(
            "SELECT 1 FROM users WHERE id = %s AND is_active = TRUE", (user_id,)
        ))

    @database_sync_to_async
    def get_user_from_token(self):
        """
        Authenticate user from JWT token in WebSocket query string.
        
        Extracts JWT token from query string (?token=xxx), validates it,
        and retrieves user from database.
        
        Returns:
            User object with id, email, name attributes, or None if:
            - Token is missing or invalid
            - Token is expired
            - User not found in database
        
        Note:
            This is a synchronous database operation wrapped for async use.
        """
        try:
            token = parse_qs(self.scope['query_string'].decode()).get('token', [''])[0]
            access_token = AccessToken(token) # type: ignore
            user_id = access_token['user_id']

            query = "SELECT id, email, name FROM users WHERE id = %s AND is_active = TRUE"
            result = DatabaseManager.execute_query(query, (user_id,))
            
            if result:
                class User:
                    def __init__(self, data):
                        self.id = data['id']
                        self.email = data['email']
                        self.name = data['name']
                
                return User(result[0])
            return None
        except Exception:
            return None
    
    @database_sync_to_async
    def can_user_message(self, sender_id, receiver_id):
        result = DatabaseManager.execute_function(
            'can_user_message',
            (sender_id, receiver_id)
        )
        return result[0]['can_message'] if result else False

    @database_sync_to_async
    def save_message(self, sender_id, receiver_id, content, media_url):
        """
        Save new message to messages table.
        
        Args:
            sender_id (int): ID of message sender
            receiver_id (int): ID of message recipient
            content (str): Message text content
            media_url (str, optional): URL of attached image
        
        Returns:
            dict: Complete message object with all fields:
                - id: Message ID
                - sender_id: Sender user ID
                - receiver_id: Receiver user ID
                - content: Message content
                - media_url: Image URL (or None)
                - is_read: Read status (False by default)
                - created_at: Timestamp
            
            None if insertion fails
        
        Database:
            Table: messages
            Columns: sender_id, receiver_id, content, media_url
        """
        query = """
        INSERT INTO messages (sender_id, receiver_id, content, media_url)
        VALUES (%s, %s, %s, %s)
        RETURNING id, sender_id, receiver_id, content, media_url, is_read, created_at
        """
        
        result = DatabaseManager.execute_query(
            query,
            (sender_id, receiver_id, content, media_url)
        )

        if not result:
            return None

        message = result[0]
        normalized = {}
        for key, value in message.items():
            if isinstance(value, (datetime, date)):
                normalized[key] = value.isoformat()
            else:
                normalized[key] = value

        return normalized
    
    @database_sync_to_async
    def mark_message_as_read(self, message_id, receiver_id):
        """
        Update message read status in database.
        
        Args:
            message_id (int): ID of message to mark as read
        
        Database:
            Updates: messages.is_read = TRUE
            Where: messages.id = message_id AND messages.receiver_id = the connected user
            Returns the sender_id (so the right user is notified) or None.
        """
        rows = DatabaseManager.execute_query(
            "UPDATE messages SET is_read = TRUE WHERE id = %s AND receiver_id = %s RETURNING sender_id",
            (message_id, receiver_id)
        )
        return rows[0]['sender_id'] if rows else None
