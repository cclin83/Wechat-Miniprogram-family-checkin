const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  try {
    return await cloud.openapi.security.decryptData({ encryptedData: event.encryptedData, iv: event.iv, openid: wxContext.OPENID })
  } catch (err) {
    console.error('解密步数数据失败:', err)
    throw err
  }
}
