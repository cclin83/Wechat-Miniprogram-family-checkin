const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function clearCollection(name) {
  let total = 0
  while (true) {
    const res = await db.collection(name).limit(100).get()
    if (res.data.length === 0) break
    for (const doc of res.data) {
      await db.collection(name).doc(doc._id).remove()
      total++
    }
  }
  return total
}

exports.main = async (event, context) => {
  try {
    const d1 = await clearCollection('checkins')
    const d2 = await clearCollection('feeds')
    const d3 = await clearCollection('wishes')
    const d4 = await clearCollection('redemptions')

    const users = await db.collection('users').limit(100).get()
    for (const user of users.data) {
      await db.collection('users').doc(user._id).update({
        data: { coins: 0, totalSteps: 0, totalCheckins: 0, streak: 0 }
      })
    }

    const rewards = await db.collection('rewards').limit(100).get()
    for (const reward of rewards.data) {
      await db.collection('rewards').doc(reward._id).update({
        data: { redeemed: 0 }
      })
    }

    return {
      success: true,
      deleted: { checkins: d1, feeds: d2, wishes: d3, redemptions: d4 },
      reset: { users: users.data.length, rewards: rewards.data.length }
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
