const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
function calcCoins(steps) { if (steps>=8000) return 3; if (steps>=5000) return 2; if (steps>=3000) return 1; return 0 }
function formatDate(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` }
exports.main = async (event, context) => {
  const today = formatDate(new Date())
  const targetDate = event.date || today
  try {
    const checkinsRes = await db.collection('checkins').where({ date: targetDate }).get()
    let totalCoinsAwarded = 0
    for (const checkin of checkinsRes.data) {
      const coins = calcCoins(checkin.steps)
      if (coins > 0 && !checkin.settled) {
        await db.collection('checkins').doc(checkin._id).update({ data: { coins, settled: true, settledAt: db.serverDate() } })
        await db.collection('users').where({ openid: checkin.openid }).update({ data: { coins: _.inc(coins) } })
        totalCoinsAwarded += coins
      }
    }
    const families = await db.collection('families').get()
    for (const family of families.data) {
      for (const memberOpenid of family.members) {
        const streak = await calcStreak(memberOpenid)
        if (streak > 0 && streak % 7 === 0) {
          await db.collection('users').where({ openid: memberOpenid }).update({ data: { coins: _.inc(3), streak } })
          totalCoinsAwarded += 3
        } else {
          await db.collection('users').where({ openid: memberOpenid }).update({ data: { streak } })
        }
      }
    }
    return { success: true, date: targetDate, checkinsProcessed: checkinsRes.data.length, totalCoinsAwarded }
  } catch (err) { return { success: false, error: err.message } }
}
async function calcStreak(openid) {
  const d = new Date(); d.setDate(d.getDate()-30)
  const res = await db.collection('checkins').where({ openid, date: _.gte(formatDate(d)), coins: _.gt(0) }).orderBy('date','desc').get()
  if (res.data.length === 0) return 0
  const dates = res.data.map(r => r.date)
  const today = formatDate(new Date())
  let streak = 0, checkDate = today
  for (let i = 0; i < 30; i++) {
    if (dates.includes(checkDate)) streak++
    else if (i === 0) { const y = new Date(); y.setDate(y.getDate()-1); checkDate = formatDate(y); if (dates.includes(checkDate)) streak++; else break }
    else break
    const dd = new Date(checkDate); dd.setDate(dd.getDate()-1); checkDate = formatDate(dd)
  }
  return streak
}
