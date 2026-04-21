function formatDate(date) {
  const d = date || new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function formatTime(date) {
  const d = date || new Date()
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
function timeAgo(timestamp) {
  const diff = Date.now() - timestamp
  const m = Math.floor(diff/60000), h = Math.floor(diff/3600000), d = Math.floor(diff/86400000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m}分钟前`
  if (h < 24) return `${h}小时前`
  if (d < 7) return `${d}天前`
  return formatDate(new Date(timestamp))
}
function calcCoins(steps) { if (steps>=8000) return 3; if (steps>=5000) return 2; if (steps>=3000) return 1; return 0 }
function calcProgress(steps, target) { target = target || 3000; return Math.min(Math.round((steps/target)*100), 100) }
function generateInviteCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', code = ''
  for (var i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random()*chars.length))
  return code
}
function formatSteps(steps) { if (!steps) return '0'; return steps.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') }
function todayKey() { return formatDate(new Date()) }
function getDaysInMonth(year, month) { return new Date(year, month+1, 0).getDate() }
function generateCalendar(year, month, checkinDays) {
  checkinDays = checkinDays || []
  var daysInMonth = getDaysInMonth(year, month), firstDay = new Date(year, month, 1).getDay(), calendar = []
  for (var i = 0; i < firstDay; i++) calendar.push({ day: '', empty: true })
  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = year+'-'+String(month+1).padStart(

继续补 util.js（上次被截断了）：

```powershell
@'
function formatDate(date) {
  var d = date || new Date()
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
}
function formatTime(date) {
  var d = date || new Date()
  return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')
}
function timeAgo(ts) {
  var diff=Date.now()-ts,m=Math.floor(diff/60000),h=Math.floor(diff/3600000),d=Math.floor(diff/86400000)
  if(m<1)return'刚刚';if(m<60)return m+'分钟前';if(h<24)return h+'小时前';if(d<7)return d+'天前'
  return formatDate(new Date(ts))
}
function calcCoins(s){if(s>=8000)return 3;if(s>=5000)return 2;if(s>=3000)return 1;return 0}
function calcProgress(s,t){t=t||3000;return Math.min(Math.round((s/t)*100),100)}
function generateInviteCode(){var c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',r='';for(var i=0;i<6;i++)r+=c.charAt(Math.floor(Math.random()*c.length));return r}
function formatSteps(s){if(!s)return'0';return s.toString().replace(/\B(?=(\d{3})+(?!\d))/g,',')}
function todayKey(){return formatDate(new Date())}
function getDaysInMonth(y,m){return new Date(y,m+1,0).getDate()}
function generateCalendar(y,m,cd){cd=cd||[];var dm=getDaysInMonth(y,m),fd=new Date(y,m,1).getDay(),cal=[];for(var i=0;i<fd;i++)cal.push({day:'',empty:true});for(var d=1;d<=dm;d++){var ds=y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');cal.push({day:d,date:ds,isToday:ds===todayKey(),checked:cd.includes(ds),empty:false})}return cal}
function calcStreak(cd){if(!cd||cd.length===0)return 0;var sorted=cd.slice().sort().reverse(),streak=0,ck=todayKey();for(var i=0;i<sorted.length;i++){if(sorted[i]===ck){streak++;var dd=new Date(ck);dd.setDate(dd.getDate()-1);ck=formatDate(dd)}else if(i===0&&sorted[i]===formatDate(new Date(Date.now()-86400000))){ck=sorted[i];i--;continue}else break}return streak}
var MOOD_TAGS=[{emoji:'😊',text:'开心'},{emoji:'🌤️',text:'天气好'},{emoji:'💪',text:'有劲'},{emoji:'🌸',text:'看到花'},{emoji:'🐦',text:'听到鸟'},{emoji:'🏃',text:'走得快'},{emoji:'😌',text:'舒服'},{emoji:'🌅',text:'风景美'}]
module.exports={formatDate:formatDate,formatTime:formatTime,timeAgo:timeAgo,calcCoins:calcCoins,calcProgress:calcProgress,generateInviteCode:generateInviteCode,formatSteps:formatSteps,todayKey:todayKey,getDaysInMonth:getDaysInMonth,generateCalendar:generateCalendar,calcStreak:calcStreak,MOOD_TAGS:MOOD_TAGS}
