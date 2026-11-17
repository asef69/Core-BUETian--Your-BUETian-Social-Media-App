import { toAbsoluteMediaUrl } from '../config';

const VIDEO_PATTERN = /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i;

/**
 * Collect the media attached to a post, whatever shape the API used for it.
 * Returns [{ url, type: 'image' | 'video' }] with absolute URLs.
 */
export const getPostMedia = (post) => {
  if (!post) return [];

  const raw =
    post.media_urls ||
    post.media_urls_list ||
    post.media_files ||
    post.media ||
    post.images ||
    post.videos ||
    [];
  const list = Array.isArray(raw) ? raw : [raw];

  const items = list
    .map((item) => {
      if (!item) return null;
      if (typeof item === 'string') {
        return { url: item, type: VIDEO_PATTERN.test(item) ? 'video' : 'image' };
      }
      const url = item.media_url || item.url || item.file || item.image || item.video;
      if (!url) return null;
      const declared = item.media_type || item.type;
      return { url, type: declared || (VIDEO_PATTERN.test(url) ? 'video' : 'image') };
    })
    .filter(Boolean);

  if (items.length === 0) {
    const single = post.media_url || post.image || post.video;
    if (single) {
      items.push({
        url: single,
        type: post.media_type === 'video' || VIDEO_PATTERN.test(single) ? 'video' : 'image',
      });
    }
  }

  return items.map((item) => ({
    url: toAbsoluteMediaUrl(item.url),
    type: item.type === 'video' ? 'video' : 'image',
  }));
};
