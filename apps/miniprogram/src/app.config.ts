export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/favorites/index',
    'pages/profile/index',
    'pages/knowledge/index',
    'pages/login/index',
    'pages/contribute/index',
    'pages/submissions/index',
  ],
  tabBar: {
    color: '#778179',
    selectedColor: '#2e7255',
    backgroundColor: '#ffffff',
    list: [
      { pagePath: 'pages/index/index', text: '看看' },
      { pagePath: 'pages/favorites/index', text: '收藏' },
      { pagePath: 'pages/profile/index', text: '我的' },
    ],
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#f5f1e8',
    navigationBarTitleText: '常识地图',
    navigationBarTextStyle: 'black',
  },
});
