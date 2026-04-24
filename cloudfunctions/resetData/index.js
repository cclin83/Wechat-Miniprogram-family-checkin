const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 1. 清空 checkins
    const checkins = await db.collection('checkins').count()
    let deleted1 = 0
    while (deleted1 < checkins.total) {
      const res = await db.collection('checkins').limit(100).remove()
      deleted1 += res.stats.removed
    }

    // 2. 清空 feeds
    const feeds = await db.collection('feeds').count()
    let deleted2 = 0
    while (deleted2 < feeds.total) {
      const res = await db.collection('feeds').limit(100).remove()
      deleted2 += res.stats.removed
    }

    // 3. 清空 wishes
    const wishes = await db.collection('wishes').count()
    let deleted3 = 0
    while (deleted3 < wishes.total) {
      const res = await db.collection('wishes').limit(100).remove()
      deleted3 += res.stats.removed
    }

    // 4. 重置 users 的金币和统计数据
    const users = await db.collection('users').limit(100).get()
    for (const user of users.data) {
      await db.collection('users').doc(user._id).update({
        data: { coins: 0, totalSteps: 0, totalCheckins: 0, streak: 0 }
      })
    }

    // 5. 重置 rewards 的已兑换数
    const rewards = await db.collection('rewards').limit(100).get()
    for (const reward of rewards.data) {
      await db.collection('rewards').doc(reward._id).update({
        data: { redeemed: 0 }
      })
    }

    return {
      success: true,
      deleted: { checkins: deleted1, feeds: deleted2, wishes: deleted3 },
      reset: { users: users.data.length, rewards: rewards.data.length }
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
