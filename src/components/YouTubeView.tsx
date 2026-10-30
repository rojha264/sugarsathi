import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { youtubeThumb, youtubeWatch } from '@shared/youtube';
import { useT } from '@/i18n/useT';
import { Txt } from './ui';

/**
 * The page the player runs in. YouTube asks embedding apps to identify themselves with an HTTPS
 * origin named after the app id (reverse-DNS), sent as the Referer.
 */
export const PLAYER_ORIGIN = 'https://com.sugarsaathi.app';

/** After this long without "playing" (autoplay blocked, slow network) the player is shown anyway so it can be tapped. */
const REVEAL_AFTER_MS = 2500;

/**
 * YouTube's IFrame Player API on a tiny page. It tells the app when the video really starts, so the app
 * can keep the player hidden until then (Android WebView otherwise shows its grey "video" robot icon).
 */
const playerHtml = (id: string, loop: boolean) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;overflow:hidden;background:#000;overscroll-behavior:none}#p,iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style></head>
<body><div id="p"></div><script>
function send(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(m)}
function onYouTubeIframeAPIReady(){
  new YT.Player('p',{videoId:'${id}',host:'https://www.youtube-nocookie.com',
    playerVars:{autoplay:1,playsinline:1,rel:0,modestbranding:1${loop ? `,loop:1,playlist:'${id}'` : ''},origin:'${PLAYER_ORIGIN}'},
    events:{
      onReady:function(e){e.target.playVideo();setTimeout(function(){send('ready')},${REVEAL_AFTER_MS})},
      onStateChange:function(e){if(e.data===1||e.data===2||e.data===3)send('playing')},
      onError:function(){send('error')}
    }});
}
</script><script src="https://www.youtube.com/iframe_api" onerror="send('error')"></script></body></html>`;

/**
 * A YouTube video playing inside the app. Until it actually plays, the video's thumbnail and a spinner
 * show instead (the player is invisible, never covered: YouTube's rules forbid drawing over it).
 */
export function YouTubeView({ id, loop = false }: { id: string; loop?: boolean }) {
  const { t } = useT();
  const [state, setState] = useState<{ for: string; shown: boolean; failed: boolean }>({ for: id, shown: false, failed: false });
  // A different video starts hidden again.
  if (state.for !== id) setState({ for: id, shown: false, failed: false });

  if (state.failed) {
    return (
      <View style={styles.center}>
        <Txt style={{ color: '#fff' }} center>
          {t('videoFail')}
        </Txt>
      </View>
    );
  }
  return (
    <View style={StyleSheet.absoluteFill}>
      {!state.shown ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image source={{ uri: youtubeThumb(id) }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={styles.center}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        </View>
      ) : null}
      <WebView
        source={{ html: playerHtml(id, loop), baseUrl: PLAYER_ORIGIN }}
        originWhitelist={['*']}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        // The page itself never scrolls, so an up/down swipe on the video moves the screen behind it.
        scrollEnabled={false}
        nestedScrollEnabled={false}
        overScrollMode="never"
        bounces={false}
        style={{ backgroundColor: 'transparent', opacity: state.shown ? 1 : 0 }}
        containerStyle={{ backgroundColor: 'transparent' }}
        onMessage={(e) => {
          const m = e.nativeEvent.data;
          if (m === 'error') setState((s) => ({ ...s, failed: true }));
          else setState((s) => (s.shown ? s : { ...s, shown: true }));
        }}
        onError={() => setState((s) => ({ ...s, failed: true }))}
        // The YouTube logo and "watch on YouTube" open the YouTube app, not a page inside ours.
        onShouldStartLoadWithRequest={(req) => {
          if (!req.isTopFrame || req.url === 'about:blank' || req.url.startsWith(PLAYER_ORIGIN)) return true;
          Linking.openURL(req.url.includes('youtube') ? youtubeWatch(id) : req.url).catch(() => {});
          return false;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
});
