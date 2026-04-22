const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  // weRunData is auto-decrypted by cloud when using CloudID
  var weRunData = event.weRunData
  if (weRunData && weRunData.data) {
    return weRunData.data
  }
  // fallback: try old decrypt method
  try {
    var wxContext = cloud.getWXContext()
    return await cloud.openapi.security.decryptData({
      encryptedData: event.encryptedData,
      iv: event.iv,
      openid: wxContext.OPENID
    })
  } catch (err) {
    console.error('decrypt failed:', err)
    throw err
  }
}
