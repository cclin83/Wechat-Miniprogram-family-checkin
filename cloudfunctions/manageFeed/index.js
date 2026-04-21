const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
function formatDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function formatTime(d) { return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }
exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  const { action } = event
  if (action === 'deleteFeed') {
    try {
      const feed = await db.collection('feeds').doc(event.feedId).get()
      if (feed.data.openid !== openid) { const u = await db.collection('users').where({ openid }).get(); if (!u.data[0]||u.data[0].role!=='admin') return { success: false, error: '无权删除' } }
      await db.collection('feeds').doc(event.feedId).remove()
      return { success: true }
    } catch (err) { return { success: false, error: err.message } }
  }
  if (action === 'sendCheckinReminder') {
    try {
      const family = await db.collection('families').doc(event.familyId).get()
      const today = formatDate(new Date()), results = []
      for (const mid of family.data.members) {
        const c = await db.collection('checkins').where({ openid: mid, date: today }).get()
        if (c.data.length === 0) {
          try { await cloud.openapi.subscribeMessage.send({ touser: mid, templateId: 'YOUR_TEMPLATE_ID', page: '/pages/checkin/checkin', data: { thing1: {value:'今日健步打卡'}, thing2: {value:'家人在等你一起运动哦'}, time3: {value:formatTime(new Date())} } }); results.push({openid:mid,sent:true}) }
          catch (e) { results.push({openid:mid,sent:false}) }
        }
      }
      return { success: true, results }
    } catch (err) { return { success: false, error: err.message } }
  }
  if (action === 'getFamilyStats') {
    try {
      const family = await db.collection('families').doc(event.familyId).get()
      const usersRes = await db.collection('users').where({ openid: _.in(family.data.members) }).get()
      const stats = { totalMembers: family.data.members.length, totalCoins: 0, totalSteps: 0, totalCheckins: 0, members: [] }
      for (const u of usersRes.data) { stats.totalCoins+=u.coins||0; stats.totalSteps+=u.totalSteps||0; stats.totalCheckins+=u.totalCheckins||0; stats.members.push({ nickName:u.nickName, avatarUrl:u.avatarUrl, coins:u.coins||0, totalSteps:u.totalSteps||0, totalCheckins:u.totalCheckins||0, streak:u.streak||0 }) }
      stats.members.sort((a,b) => b.totalSteps-a.totalSteps)
      return { success: true, stats }
    } catch (err) { return { success: false, error: err.message } }
  }
  return { success: false, error: '未知操作' }
}
