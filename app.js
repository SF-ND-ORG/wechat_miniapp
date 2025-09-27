const env = require('./env/index.js');

// 检查或刷新token
function getOrRefreshToken(cb) {
    let accessToken = wx.getStorageSync('access_token');
    let refreshToken = wx.getStorageSync('refresh_token');
    
    if (accessToken) {
        cb(accessToken);
    } else if (refreshToken) {
        // 如果只有刷新令牌，尝试刷新
        refreshAccessToken(refreshToken, cb);
    } else {
        // 没有任何令牌，执行登录
        wxLogin(cb);
    }
}

// 微信登录获取令牌
function wxLogin(cb) {
    wx.login({
        success: res => {
            wx.request({
                method: "POST",
                url: env.API_BASE_URL+'/api/wechat/login',
                data: { code: res.code },
                success: r => {
                    // 保存两种令牌
                    wx.setStorageSync('access_token', r.data.access_token);
                    wx.setStorageSync('refresh_token', r.data.refresh_token);
                    cb(r.data.access_token);
                }
            })
        }
    })
}

// 使用刷新令牌获取新的访问令牌
function refreshAccessToken(refreshToken, cb) {
    wx.request({
        method: "POST",
        url: env.API_BASE_URL+'/api/wechat/refresh',
        data: { refresh_token: refreshToken },
        success: r => {
            if (r.data.access_token) {
                // 更新两种令牌
                wx.setStorageSync('access_token', r.data.access_token);
                wx.setStorageSync('refresh_token', r.data.refresh_token);
                cb(r.data.access_token);
            } else {
                // 刷新失败，清除旧令牌并重新登录
                wx.removeStorageSync('access_token');
                wx.removeStorageSync('refresh_token');
                wxLogin(cb);
            }
        },
        fail: () => {
            // 请求失败，重新登录
            wx.removeStorageSync('access_token');
            wx.removeStorageSync('refresh_token');
            wxLogin(cb);
        }
    })
}

// 包装wx.request，自动处理令牌刷新
function request(options) {
    getOrRefreshToken(token => {
        const originalRequest = () => {
            wx.request({
                ...options,
                header: { 
                    ...(options.header || {}),
                    Authorization: 'Bearer ' + token 
                },
                fail: options.fail,
                success: (res) => {
                    // 检查是否令牌过期
                    if (res.statusCode === 401 && (res.data.detail === "token已过期，请刷新"||res.data.detail === "token无效")) {
                        // 尝试使用刷新令牌
                        const refreshToken = wx.getStorageSync('refresh_token');
                        if (refreshToken) {
                            refreshAccessToken(token => {
                                // 重试原始请求
                                originalRequest();
                            });
                        } else {
                            // 没有刷新令牌，重新登录
                            wxLogin(token => {
                                originalRequest();
                            });
                        }
                    } else {
                        // 正常响应
                        if (options.success) {
                            options.success(res);
                        }
                    }
                },
                complete: options.complete
            });
        };
        
        originalRequest();
    });
}

// 检查是否已绑定
function checkBindAndRedirect() {
    request({
        url: env.API_BASE_URL+'/api/wechat/isbound',
        success: res => {
            if(res.errMsg) {
                console.log(res.errMsg);
            }
            if (res.data.is_bound) {
                wx.redirectTo({ url: '/pages/wall/wall' });
            } else {
                wx.redirectTo({ url: '/pages/bind/bind' });
            }
        },
        fail: res => {
            console.log(res.errMsg);
        }
    });
}

App({
  globalData: {
    env: env,
    request: request // 导出包装后的请求函数
  },
  
  onLaunch() {
    checkBindAndRedirect();
    console.log('当前环境:', env.ENV_TYPE);
    console.log('API地址:', env.API_BASE_URL);
  }
});