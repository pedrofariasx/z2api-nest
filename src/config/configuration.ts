export default () => ({
  port: parseInt(process.env.PORT || '8080', 10),
  source: {
    protocol: 'https:',
    host: 'chat.z.ai',
    token: process.env.TOKEN || '',
  },
  api: {
    debug: process.env.DEBUG === 'true',
    debugMsg: process.env.DEBUG_MSG === 'true',
    think: process.env.THINK_TAGS_MODE || 'reasoning',
    anonymous: !process.env.TOKEN,
  },
  model: {
    default: process.env.MODEL || 'glm-4.7',
  },
});
