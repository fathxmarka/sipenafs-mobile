import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleProp,
  TextStyle,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import {
  formatCbtText,
  hasArabicScript,
  hasCjkScript,
  hasComplexCbtHtmlOrMath,
  extractCbtImages,
  resolveCbtMediaUrl,
  renderCbtHtmlWithKatex,
} from '../utils/cbtFormatter';

interface RichCbtContentProps {
  content?: string | null;
  apiUrl: string;
  extraImageUrl?: string | null;
  textStyle?: StyleProp<TextStyle>;
  fontSize?: number;
  textColor?: string;
  imageHeight?: number;
  nonInteractiveWebView?: boolean;
  onZoomImage?: (uri: string) => void;
}

export default function RichCbtContent({
  content,
  apiUrl,
  extraImageUrl,
  textStyle,
  fontSize = 14,
  textColor = '#0F172A',
  imageHeight = 180,
  nonInteractiveWebView = false,
  onZoomImage,
}: RichCbtContentProps) {
  const [webHeight, setWebHeight] = useState<number>(Math.max(40, fontSize * 2.5));
  const [failedImages, setFailedImages] = useState<{ [url: string]: boolean }>({});
  const [loadingImages, setLoadingImages] = useState<{ [url: string]: boolean }>({});
  const [retryTokens, setRetryTokens] = useState<{ [url: string]: number }>({});

  const imageUrls = useMemo(() => {
    const list: string[] = [];
    if (extraImageUrl) {
      const resolvedExtra = resolveCbtMediaUrl(extraImageUrl, apiUrl);
      if (resolvedExtra) list.push(resolvedExtra);
    }
    const inlineImgs = extractCbtImages(content, apiUrl);
    inlineImgs.forEach((url) => {
      if (!list.includes(url)) list.push(url);
    });
    return list;
  }, [content, extraImageUrl, apiUrl]);

  // Bersihkan tag <img> dari konten teks agar gambar dirender konsisten lewat Native expo-image
  const contentWithoutImages = useMemo(() => {
    if (!content || typeof content !== 'string') return '';
    const trimmed = content.trim();
    if (/^(https?:\/\/|\/public\/|\/api\/public\/|data:image\/)/i.test(trimmed) && !trimmed.includes('<')) {
      return '';
    }
    return content.replace(/<img\b[^>]*>/gi, '').trim();
  }, [content]);

  const useWebView = useMemo(
    () => hasComplexCbtHtmlOrMath(contentWithoutImages),
    [contentWithoutImages]
  );

  const cleanText = useMemo(
    () => (useWebView ? '' : formatCbtText(contentWithoutImages)),
    [useWebView, contentWithoutImages]
  );

  const isRtl = useMemo(() => hasArabicScript(cleanText), [cleanText]);
  const isCjk = useMemo(() => hasCjkScript(cleanText), [cleanText]);

  const webHtml = useMemo(() => {
    if (!useWebView) return '';
    const rendered = renderCbtHtmlWithKatex(contentWithoutImages, apiUrl);
    const dirAttr = hasArabicScript(contentWithoutImages) ? 'rtl' : 'auto';
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="katex/katex.min.css" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: transparent;
      color: ${textColor};
      font-family: -apple-system, BlinkMacSystemFont, "Roboto", "Noto Sans Arabic", "Noto Sans CJK SC", "Noto Sans", sans-serif;
      font-size: ${fontSize}px;
      line-height: 1.7;
      overflow-x: auto;
      -webkit-text-size-adjust: 100%;
    }
    p { margin: 0 0 6px 0; }
    p:last-child { margin-bottom: 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 6px 0;
      font-size: ${Math.max(12, fontSize - 1)}px;
    }
    th, td {
      border: 1px solid #CBD5E1;
      padding: 5px 8px;
      text-align: left;
    }
    th { background: #F1F5F9; font-weight: 700; }
    .katex { font-size: 1.08em; }
    .katex-display { margin: 6px 0; overflow-x: auto; overflow-y: hidden; }
  </style>
</head>
<body dir="${dirAttr}">
  <div id="cbt-root">${rendered}</div>
  <script>
    (function() {
      function sendHeight() {
        var root = document.getElementById('cbt-root');
        var h = Math.max(root ? root.scrollHeight : 0, document.body.scrollHeight, document.documentElement.scrollHeight);
        if (window.ReactNativeWebView && h > 0) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height: Math.ceil(h) + 6 }));
        }
      }
      window.addEventListener('load', function() {
        sendHeight();
        setTimeout(sendHeight, 120);
        setTimeout(sendHeight, 400);
      });
      if (typeof ResizeObserver !== 'undefined') {
        var ro = new ResizeObserver(sendHeight);
        ro.observe(document.body);
      }
      sendHeight();
    })();
  </script>
</body>
</html>`;
  }, [useWebView, contentWithoutImages, apiUrl, fontSize, textColor]);

  const computedLineHeight = isRtl
    ? Math.max(fontSize * 1.9, 28)
    : isCjk
    ? Math.max(fontSize * 1.65, 24)
    : undefined;

  return (
    <View style={{ width: '100%' }}>
      {useWebView ? (
        <View
          pointerEvents={nonInteractiveWebView ? 'none' : 'auto'}
          style={{ width: '100%', height: webHeight, overflow: 'hidden' }}
        >
          <WebView
            originWhitelist={['*']}
            source={{
              html: webHtml,
              baseUrl: Platform.OS === 'android' ? 'file:///android_asset/' : undefined,
            }}
            style={{ width: '100%', height: webHeight, backgroundColor: 'transparent', opacity: 0.99 }}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            javaScriptEnabled={true}
            domStorageEnabled={false}
            onMessage={(event) => {
              try {
                const payload = JSON.parse(event.nativeEvent.data);
                if (payload?.type === 'height' && Number(payload.height) > 10) {
                  setWebHeight(Math.min(1800, Number(payload.height)));
                }
              } catch {}
            }}
          />
        </View>
      ) : Boolean(cleanText) ? (
        <Text
          style={[
            {
              fontSize,
              color: textColor,
              lineHeight: computedLineHeight ?? Math.round(fontSize * 1.55),
            },
            textStyle,
            isRtl && {
              writingDirection: 'rtl',
              textAlign: 'right',
              fontSize: Math.max(fontSize + 3, 18),
              lineHeight: Math.max((fontSize + 3) * 2.0, 36),
              includeFontPadding: true,
            },
            isCjk && !isRtl && {
              fontSize: Math.max(fontSize + 1, 15),
              lineHeight: Math.max((fontSize + 1) * 1.65, 25),
            },
          ]}
        >
          {cleanText}
        </Text>
      ) : null}

      {imageUrls.length > 0 && (
        <View style={{ marginTop: cleanText || useWebView ? 8 : 0, gap: 8 }}>
          {imageUrls.map((url, idx) => {
            const retrySeed = retryTokens[url] || 0;
            const effectiveUri =
              retrySeed > 0 && !url.startsWith('data:')
                ? `${url}${url.includes('?') ? '&' : '?'}_r=${retrySeed}`
                : url;
            const isFailed = Boolean(failedImages[url]);
            const isLoading = Boolean(loadingImages[url]);

            return (
              <View
                key={`${url}-${idx}`}
                style={{
                  width: '100%',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  backgroundColor: '#F8FAFC',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {isFailed ? (
                  <View style={{ padding: 14, alignItems: 'center', gap: 6 }}>
                    <Ionicons name="image-outline" size={24} color="#94A3B8" />
                    <Text style={{ fontSize: 12, color: '#64748B', textAlign: 'center' }}>
                      Gambar gagal dimuat. Periksa koneksi jaringan sekolah.
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setFailedImages((prev) => ({ ...prev, [url]: false }));
                        setRetryTokens((prev) => ({ ...prev, [url]: (prev[url] || 0) + 1 }));
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 6,
                        backgroundColor: '#E0F2FE',
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#0369A1' }}>
                        Muat Ulang Gambar
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ width: '100%', height: imageHeight, justifyContent: 'center', alignItems: 'center' }}>
                    <Image
                      source={{ uri: effectiveUri }}
                      style={{ width: '100%', height: imageHeight }}
                      contentFit="contain"
                      transition={150}
                      onLoadStart={() => setLoadingImages((prev) => ({ ...prev, [url]: true }))}
                      onLoad={() => setLoadingImages((prev) => ({ ...prev, [url]: false }))}
                      onError={() => {
                        setLoadingImages((prev) => ({ ...prev, [url]: false }));
                        setFailedImages((prev) => ({ ...prev, [url]: true }));
                      }}
                    />
                    {isLoading && (
                      <View
                        style={{
                          position: 'absolute',
                          inset: 0,
                          justifyContent: 'center',
                          alignItems: 'center',
                          backgroundColor: 'rgba(248, 250, 252, 0.7)',
                        }}
                      >
                        <ActivityIndicator size="small" color="#0284C7" />
                      </View>
                    )}
                    {Boolean(onZoomImage) && (
                      <TouchableOpacity
                        onPress={() => onZoomImage?.(effectiveUri)}
                        activeOpacity={0.8}
                        style={{
                          position: 'absolute',
                          right: 6,
                          bottom: 6,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: 'rgba(15, 23, 42, 0.72)',
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 6,
                        }}
                      >
                        <Ionicons name="expand-outline" size={12} color="#FFFFFF" />
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>
                          Perbesar
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
