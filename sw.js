if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker 註冊成功！Scope 範圍係：', registration.scope);
      })
      .catch((error) => {
        console.log('Service Worker 註冊失敗：', error);
      });
  });
}
