function formatDate(date) {
  var d = date || new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function formatTime(date) {
  var d = date || new Date()
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

function timeAgo(timestamp) {
  var diff = Date.now() - timestamp
  var m = Math.floor(diff / 60000)
  var h = Math.floor(diff / 3600000)
  var d = Math.floor(diff / 86400000)
  if (m < 1) return '刚刚'
  if (m < 60) return m + '分钟前'
  if (h < 24) return h + '小时前'
  if (d < 7) return d + '天前'
  return formatDate(new Date(timestamp))
}

function calcCoins(steps) {
  if (steps >= 8000) return 3
  if (steps >= 5000) return 2
  if (steps >= 3000) return 1
  return 0
}

function calcProgress(steps, target) {
  target = target || 3000
  return Math.min(Math.round((steps / target) * 100), 100)
}

function generateInviteCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  var code = ''
  for (var i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function formatSteps(steps) {
  if (!steps) return '0'
  return steps.toString().replace(/B(?=(d{3})+(?!d))/g, ',')
}

function todayKey() {
  return formatDate(new Date())
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function generateCalendar(year, month, checkinDays) {
  checkinDays = checkinDays || []
  var daysInMonth = getDaysInMonth(year, month)
  var firstDay = new Date(year, month, 1).getDay()
  var calendar = []
  for (var i = 0; i < firstDay; i++) {
    calendar.push({ day: '', empty: true })
  }
  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')
    calendar.push({
      day: d,
      date: dateStr,
      isToday: dateStr === todayKey(),
      checked: checkinDays.includes(dateStr),
      empty: false
    })
  }
  return calendar
}

function calcStreak(checkinDays) {
  if (!checkinDays || checkinDays.length === 0) return 0
  var sorted = checkinDays.slice().sort().reverse()
  var streak = 0
  var checkDate = todayKey()
  for (var i = 0; i < sorted.length; i++) {
    if (sorted[i] === checkDate) {
      streak++
      var dd = new Date(checkDate)
      dd.setDate(dd.getDate() - 1)
      checkDate = formatDate(dd)
    } else if (i === 0) {
      var yesterday = new Date(Date.now() - 86400000)
      if (sorted[i] === formatDate(yesterday)) {
        checkDate = sorted[i]
        i--
        continue
      } else {
        break
      }
    } else {
      break
    }
  }
  return streak
}

var MOOD_TAGS = [
  { emoji: '😊', text: '开心' },
  { emoji: '🌤️', text: '天气好' },
  { emoji: '💪', text: '有劲' },
  { emoji: '🌸', text: '看到花' },
  { emoji: '🐦', text: '听到鸟' },
  { emoji: '🏃', text: '走得快' },
  { emoji: '😌', text: '舒服' },
  { emoji: '🌅', text: '风景美' }
]

// 云文件 ID 转临时 URL 缓存
var _urlCache = {}
async function batchGetTempUrls(fileIds) {
  if (!fileIds || fileIds.length === 0) return {}
  var toFetch = []
  var result = {}
  fileIds.forEach(function(id) {
    if (!id || id.indexOf('cloud://') !== 0) { result[id] = id; return }
    if (_urlCache[id]) { result[id] = _urlCache[id]; return }
    toFetch.push(id)
  })
  if (toFetch.length > 0) {
    try {
      var res = await wx.cloud.getTempFileURL({ fileList: toFetch })
      res.fileList.forEach(function(f) {
        if (f.tempFileURL) { _urlCache[f.fileID] = f.tempFileURL; result[f.fileID] = f.tempFileURL }
        else { result[f.fileID] = f.fileID }
      })
    } catch (e) {
      toFetch.forEach(function(id) { result[id] = id })
    }
  }
  return result
}

module.exports = {
  batchGetTempUrls: batchGetTempUrls,
  formatDate: formatDate,
  formatTime: formatTime,
  timeAgo: timeAgo,
  calcCoins: calcCoins,
  calcProgress: calcProgress,
  generateInviteCode: generateInviteCode,
  formatSteps: formatSteps,
  todayKey: todayKey,
  getDaysInMonth: getDaysInMonth,
  generateCalendar: generateCalendar,
  calcStreak: calcStreak,
  MOOD_TAGS: MOOD_TAGS
}
