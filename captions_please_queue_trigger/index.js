const allSettled = require('promise.allsettled');
const vision = require('./vision');
const tweet_reply = require('./tweet_reply');
const twitter = require('../shared/twitter');

const get_successful_promises = (settled_promises) =>
  settled_promises
    .filter(({ status }) => status === 'fulfilled')
    .map(({ value }) => value);

async function async_for_each(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

module.exports = async (context, item) => {
  context.log('Picking up the queue item:' + JSON.stringify(item, null, 2));
  const image_data_promises = item.media.map(
    ({ media_url_https, description, ext_alt_text }) =>
      vision(media_url_https).then((vision_data) => ({
        ...vision_data,
        alt_text: description || ext_alt_text,
      }))
  );

  const image_items = await allSettled(image_data_promises).then(
    get_successful_promises
  );

  let { to_reply_id } = item;
  if (image_items.length == 0) {
    await twitter.reply(
      to_reply_id,
      'Oh this is embarrasing, but there was an error trying to decode the tweet. Sorry!'
    );
  }

  async_for_each(image_items, async (image_data, i) => {
    const index = image_items.length > 1 ? i : undefined;
    to_reply_id = await tweet_reply(to_reply_id, image_data, index);
  });
};
