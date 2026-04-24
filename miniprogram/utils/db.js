var db = null
var _ = null
var collections = {}
try {
  db = wx.cloud.database()
  _ = db.command
  collections = {
    users: db.collection('users'), families: db.collection('families'),
    checkins: db.collection('checkins'), rewards: db.collection('rewards'), feeds: db.collection('feeds'),
    wishes: db.collection('wishes'), redemptions: db.collection('redemptions')
  }
} catch (e) {
  console.log('cloud database not available', e)
}
async function getOrCreateUser(openid, userInfo) {
  const res = await collections.users.where({ openid }).get()
  if (res.data.length > 0) return res.data[0]
  const newUser = { openid, nickName: userInfo.nickName||'家人', avatarUrl: userInfo.avatarUrl||'', role: null, familyId: null, coins: 0, totalSteps: 0, totalCheckins: 0, streak: 0, createdAt: db.serverDate() }
  const addRes = await collections.users.add({ data: newUser })
  newUser._id = addRes._id
  return newUser
}
async function updateUser(userId, data) { return collections.users.doc(userId).update({ data }) }
async function getUserByOpenid(openid) { const res = await collections.users.where({ openid }).get(); return res.data[0] || null }
async function createFamily(name, adminOpenid) {
  const util = require('./util')
  const family = { name, inviteCode: util.generateInviteCode(), adminOpenid, members: [adminOpenid], createdAt: db.serverDate() }
  const res = await collections.families.add({ data: family })
  family._id = res._id
  return family
}
async function joinFamily(inviteCode, openid) {
  const res = await collections.families.where({ inviteCode }).get()
  if (res.data.length === 0) throw new Error('邀请码无效')
  const family = res.data[0]
  if (family.members.includes(openid)) return family
  await collections.families.doc(family._id).update({ data: { members: _.push(openid) } })
  family.members.push(openid)
  return family
}
async function getFamily(familyId) { const res = await collections.families.doc(familyId).get(); return res.data }
async function getFamilyMembers(familyId) {
  const family = await getFamily(familyId)
  if (!family) return []
  const res = await collections.users.where({ openid: _.in(family.members) }).get()
  return res.data
}
async function checkin(openid, familyId, data) {
  const util = require('./util')
  const today = util.todayKey()
  const existing = await collections.checkins.where({ openid, date: today }).get()
  if (existing.data.length > 0) {
    var prev = existing.data[0]
    var prevCoins = prev.coins || 0
    var prevSteps = prev.steps || 0
    await collections.checkins.doc(prev._id).update({ data: { steps: data.steps, coins: data.coins, content: data.content||'', images: data.images||[], mood: data.mood||'', settled: true, updatedAt: db.serverDate() } })
    // 返回旧记录的金币和步数，供调用方计算差值
    return { updated: true, prevCoins: prevCoins, prevSteps: prevSteps }
  }
  await collections.checkins.add({ data: { openid, familyId, date: today, steps: data.steps, coins: data.coins, content: data.content||'', images: data.images||[], mood: data.mood||'', settled: true, createdAt: db.serverDate() } })
  return { updated: false, prevCoins: 0, prevSteps: 0 }
}
async function getMonthCheckins(openid, year, month) {
  const startDate = `${year}-${String(month+1).padStart(2,'0')}-01`
  const endMonth = month+2 > 12 ? 1 : month+2
  const endYear = month+2 > 12 ? year+1 : year
  const endDate = `${endYear}-${String(endMonth).padStart(2,'0')}-01`
  const res = await collections.checkins.where({ openid, date: _.gte(startDate).and(_.lt(endDate)) }).orderBy('date','asc').get()
  return res.data
}
async function getTodayCheckin(openid) {
  const util = require('./util')
  const res = await collections.checkins.where({ openid, date: util.todayKey() }).get()
  return res.data[0] || null
}
async function postFeed(data) {
  return collections.feeds.add({ data: { familyId: data.familyId, openid: data.openid, nickName: data.nickName, avatarUrl: data.avatarUrl, type: data.type, content: data.content||'', images: data.images||[], mood: data.mood||'', steps: data.steps||0, coins: data.coins||0, likes: [], comments: [], createdAt: db.serverDate() } })
}
async function getFeedList(familyId, page = 0, pageSize = 20) {
  const res = await collections.feeds.where({ familyId }).orderBy('createdAt','desc').skip(page*pageSize).limit(pageSize).get()
  return res.data
}
async function likeFeed(feedId, openid) { return collections.feeds.doc(feedId).update({ data: { likes: _.push(openid) } }) }
async function unlikeFeed(feedId, openid) { return collections.feeds.doc(feedId).update({ data: { likes: _.pull(openid) } }) }
async function commentFeed(feedId, comment) {
  return collections.feeds.doc(feedId).update({ data: { comments: _.push({ openid: comment.openid, nickName: comment.nickName, avatarUrl: comment.avatarUrl, content: comment.content, createdAt: new Date().getTime() }) } })
}
async function createReward(data) {
  return collections.rewards.add({ data: { familyId: data.familyId, name: data.name, description: data.description||'', coinsNeeded: data.coinsNeeded, type: data.type, mediaUrl: data.mediaUrl||'', textContent: data.textContent||'', stock: data.stock||1, redeemed: 0, active: true, createdBy: data.createdBy, createdAt: db.serverDate() } })
}
async function getRewardList(familyId) {
  const res = await collections.rewards.where({ familyId, active: true }).orderBy('coinsNeeded','asc').get()
  return res.data
}
async function redeemReward(rewardId, openid, userCoins) {
  const reward = await collections.rewards.doc(rewardId).get()
  const r = reward.data
  if (userCoins < r.coinsNeeded) throw new Error('金币不足')
  if (r.redeemed >= r.stock) throw new Error('奖品已兑完')
  // 条件更新：只有金币 >= 所需金币时才扣减，防止并发扣到负数
  const deductRes = await collections.users.where({ openid, coins: _.gte(r.coinsNeeded) }).update({ data: { coins: _.inc(-r.coinsNeeded) } })
  if (deductRes.stats.updated === 0) throw new Error('金币不足')
  // 条件更新：只有未兑完时才增加兑换数，防止超额兑换
  const redeemRes = await collections.rewards.where({ _id: rewardId, redeemed: _.lt(r.stock) }).update({ data: { redeemed: _.inc(1) } })
  if (redeemRes.stats.updated === 0) {
    // 回滚金币
    await collections.users.where({ openid }).update({ data: { coins: _.inc(r.coinsNeeded) } })
    throw new Error('奖品已兑完')
  }
  // 记录兑换记录
  await collections.redemptions.add({ data: { rewardId: rewardId, openid: openid, createdAt: db.serverDate() } })
  return r
}
async function getUserRedemptions(openid) {
  const res = await collections.redemptions.where({ openid }).get()
  return res.data.map(function(r) { return r.rewardId })
}
// === 心愿卡 ===
async function createWish(data) {
  // 条件更新：只有金币 >= 所需金币时才扣减，防止并发扣到负数
  var deductRes = await collections.users.where({ openid: data.openid, coins: _.gte(data.cost) }).update({ data: { coins: _.inc(-data.cost) } })
  if (deductRes.stats.updated === 0) throw new Error('金币不足')
  try {
    var wish = { familyId: data.familyId, openid: data.openid, nickName: data.nickName, avatarUrl: data.avatarUrl, content: data.content, cost: data.cost, status: 'pending', fulfilledBy: '', fulfilledNickName: '', fulfilledPhoto: '', fulfilledAt: null, createdAt: db.serverDate() }
    var res = await collections.wishes.add({ data: wish })
    wish._id = res._id
    return wish
  } catch (err) {
    // 创建心愿失败，回滚金币
    await collections.users.where({ openid: data.openid }).update({ data: { coins: _.inc(data.cost) } })
    throw err
  }
}
async function getWishList(familyId) {
  var res = await collections.wishes.where({ familyId }).orderBy('createdAt', 'desc').limit(50).get()
  return res.data
}
async function fulfillWish(wishId, data) {
  return collections.wishes.doc(wishId).update({ data: { status: 'fulfilled', fulfilledBy: data.openid, fulfilledNickName: data.nickName, fulfilledPhoto: data.photoUrl || '', fulfilledAt: db.serverDate() } })
}

// === 家庭排行榜 ===
async function getTodayRanking(familyId) {
  var util = require('./util')
  var today = util.todayKey()
  // 获取家庭所有成员
  var members = await getFamilyMembers(familyId)
  if (!members || members.length === 0) return []
  // 用成员openid列表查询今日打卡，不依赖checkins的familyId字段
  var openids = members.map(function(m) { return m.openid })
  var checkinRes = await collections.checkins.where({ openid: _.in(openids), date: today }).get()
  var checkinMap = {}
  checkinRes.data.forEach(function(c) { checkinMap[c.openid] = c.steps || 0 })
  // 组装排行榜
  var ranking = members.map(function(m) {
    return { openid: m.openid, nickName: m.nickName || '家人', avatarUrl: m.avatarUrl || '', steps: checkinMap[m.openid] || 0 }
  })
  ranking.sort(function(a, b) { return b.steps - a.steps })
  return ranking
}

module.exports = { db, _, collections, getOrCreateUser, updateUser, getUserByOpenid, createFamily, joinFamily, getFamily, getFamilyMembers, checkin, getMonthCheckins, getTodayCheckin, postFeed, getFeedList, likeFeed, unlikeFeed, commentFeed, createReward, getRewardList, redeemReward, getUserRedemptions, createWish, getWishList, fulfillWish, getTodayRanking }
