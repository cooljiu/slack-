/* 引数 */
var days = 7; // 日以上経過したら削除

/*
ファイルTYPE一覧
all - All files
spaces - Posts
snippets - Snippets
images - Image files
gdocs - Google docs
zips - Zip files
pdfs - PDF file
*/

var ignoreType = "all"; // 削除対象にしないファイル形式
var noticeChannels = PropertiesService.getScriptProperties().getProperty("NOTICE_CHANNELS").split(",");
var targetChannels = PropertiesService.getScriptProperties().getProperty("TARGET_CHANNELS").split(",");

/* 削除処理 */
function deleteOldFile(){
    //var deleteFiles = SlackDelFileApp.getFileListWithOutOption(channelId, days, ignoreType); // 削除対象を取得
    var deleteFiles = SlackDelFileApp.getFileListWithOutOption(null, days, ignoreType);
    deleteFiles.files.forEach(function(file){ // 削除
      //var data = SlackDelFileApp.deleteFile(file.id);
      Logger.log('  Deleted file ' + file.name);
      // if (data.error){
      //   Logger.log('  Failed to delete file ' + file.name + ' Error: ' + data.error);
      // } else {
      //    Logger.log('  Deleted file "' + file.name + '"(id => "' + file.id + '")');
      // }
    });
}

/* メッセージ送信 */
function postDeleteFileMessage(channelId, botName, message){
  noticeChannels.forEach(function(channelName){
    Logger.log(SlackDelFileApp.postConfirm(channelName, days, ignoreType));
  });
}

/* スコープを与える */
var SlackDelFileApp = {}

/* SLACKのTOKENを読み込み */
SlackDelFileApp.SLACK_WORK_TOKEN = PropertiesService.getScriptProperties().getProperty('SLACK_WORK_TOKEN');// slackで発行したTOKENをGASの環境変数に設定

/* soundTricker/SlackApp　を使うよりurlからAPI叩いたほうが早いらしいので */
SlackDelFileApp.execute = function(method, params){
  if (params === undefined ) params = {'token' : SlackDelFileApp.SLACK_WORK_TOKEN};
  var options = {
    'method': 'POST',
    'payload': params
  }
  var res = UrlFetchApp.fetch('https://slack.com/api/' + method, options);
  return JSON.parse(res.getContentText());
}

/* 翌日の削除対象ファイルの確認 */
SlackDelFileApp.postConfirm = function(channelName, days, ignoreType){
  var channelId = SlackDelFileApp.getId(channelName, 'channels') || SlackDelFileApp.getId(channelName, 'groups');
  var deleteFiles = this.getFileListWithOutOption(channelId, days + 1, ignoreType); // 翌日の削除対象を取得
  var nullMsg = '明日の削除対象ファイルはありません';
  var listMsg = '明日の削除対象ファイルは以下 ' + deleteFiles.files.length + ' 件のファイルです。';
  
  //バイト変換
  function fileSize(size) {
    var sizes =['(B)', '(KB)', '(MB)', '(GB)', '(TB)', '(PB)', '(EB)'];
    var ext = sizes[0];
    if(typeof size==='number'){
        for (var i=1;i< sizes.length;i+=1){
            if(size>= 1024){
                size = size / 1024;
                ext = sizes[i];
            }
        }
    }
    return round(size, 2)+ext;
  }
  
  function round (value, precision, mode) {
    var m, f, isHalf, sgn; // helper variables
    precision |= 0; // making sure precision is integer
    m = Math.pow(10, precision);
    value *= m;
    sgn = (value > 0) | -(value < 0); // sign of the number
    isHalf = value % 1 === 0.5 * sgn;
    f = Math.floor(value);
  
    if (isHalf) {
      switch (mode) {
      case 'PHP_ROUND_HALF_DOWN':
        value = f + (sgn < 0); // rounds .5 toward zero
        break;
      case 'PHP_ROUND_HALF_EVEN':
        value = f + (f % 2 * sgn); // rouds .5 towards the next even integer
        break;
      case 'PHP_ROUND_HALF_ODD':
        value = f + !(f % 2); // rounds .5 towards the next odd integer
        break;
      default:
        value = f + (sgn > 0); // rounds .5 away from zero
      }
    }
  
    return (isHalf ? value : Math.round(value)) / m;
  }
  
  //アップ時間取得(ミリ秒にするためかける1000)
  function upTime(time) {
    var d = new Date(time*1000);
    return d.getFullYear()+'年'+(parseInt(d.getMonth())+1)+'月'+d.getDate()+'日';
  }
  //削除ファイルメッセージ表示
  deleteFiles.files.forEach(function(f){
    var user  = SlackDelFileApp.getUserInfo(f.user).user.name;
    if(user !== "kyo") {listMsg +=  "\n\t・" + f.name + '  ' + fileSize(f.size) + '   ' + user +'さんが'+ upTime(f.created)+ 'にアップした'+"\n\t　url_download: " + f.url_private_download + "\n\t";} 
  });
  
  var params = {
    'token': SlackDelFileApp.SLACK_WORK_TOKEN,
    'channel': channelName,
    'username' : 'ファイル削除bot', //投稿するbotの名前
    'text'     : deleteFiles.files.length == 0 ? nullMsg : listMsg //投稿するメッセージ
  }
  return this.execute('chat.postMessage', params);
}

/* ファイルの削除*/
SlackDelFileApp.deleteFile = function(id){
  var params = {
    'token': SlackDelFileApp.SLACK_WORK_TOKEN,
    'file' : id // delete対象はidで指定
  }
 return this.execute('files.delete', params);
}

/* ファイルのリスト取得 */ // unused
SlackDelFileApp.getFilesList = function(params){
  params.token = SlackDelFileApp.SLACK_WORK_TOKEN;
   return this.execute('files.list', params);
}

/* ユーザー情報を取得 */
SlackDelFileApp.getUserInfo = function(id){
    var params = {
    'token': SlackDelFileApp.SLACK_WORK_TOKEN,
    'user' : id // ユーザーidで指定
  }
   return this.execute('users.info', params);
}

/* チャネル名（グループ名）からidを取得 */
SlackDelFileApp.getId = function(name, type) { // 公開->channel 非公開->group という扱いらしいのでどちらにも対応
  if(type === undefined) type = 'channels';
  
  var channelsList
  if(type === 'channels'){
    channelsList = this.execute('channels.list').channels;
  }else if(type ==='groups'){
    channelsList = this.execute('groups.list').groups;
  }
  var channelId = '';
  channelsList.some(function(channels){
    if (channels.name.match(name)){
      channelId = channels.id;
      return true;
    } 
  });
  return channelId;
}

/* 日付　->　秒変換　->　日時*/
SlackDelFileApp.elapsedDaysToUnixTime = function(days){  
  var date = new Date();
  var now = Math.floor(date.getTime()/ 1000); // unixtime[sec]
  return now - 8.64e4 * days + ''; // 8.64e4[sec] = 1[day] 文字列じゃないと動かないので型変換している
}

/* 指定したタイプ以外のファイルを削除 */
SlackDelFileApp.getFileListWithOutOption = function(channelId, days, ignoreType, count){
  if(count === undefined) count = 1000;
  var params = {
    'token'	: SlackDelFileApp.SLACK_WORK_TOKEN,
    'count'	: count,
    'ts_to'	: SlackDelFileApp.elapsedDaysToUnixTime(days),
    //'channel'	: channelId,
  }
  var allFiles = this.execute('files.list', params); // まず、全てのファイルを取ってくる  
  return allFiles;
}
