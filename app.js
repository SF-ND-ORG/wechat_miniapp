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

// 清除本地令牌并重新登录
function resetTokensAndLogin(cb) {
    wx.removeStorageSync('access_token');
    wx.removeStorageSync('refresh_token');
    wxLogin(cb);
}

// 微信登录获取令牌
function wxLogin(cb) {
    wx.login({
        success: res => {
            wx.request({
                method: "POST",
                url: env.API_BASE_URL + '/api/wechat/login',
                data: { code: res.code },
                success: r => {
                    const data = r.data || {};
                    if (!data.access_token) {
                        console.error('微信登录失败:', data);
                        cb(undefined);
                        return;
                    }
                    // 保存两种令牌（会话存储）
                    wx.setStorageSync('access_token', data.access_token);
                    wx.setStorageSync('refresh_token', data.refresh_token);
                    cb(data.access_token);
                },
                fail: res => {
                    console.error('微信登录请求失败:', res.errMsg);
                    cb(undefined);
                }
            })
        },
        fail: res => {
            console.error('wx.login 失败:', res.errMsg);
            cb(undefined);
        }
    })
}

// 使用刷新令牌获取新的访问令牌
function refreshAccessToken(refreshToken, cb) {
    if (!refreshToken) {
        resetTokensAndLogin(cb);
        return;
    }
    wx.request({
        method: "POST",
        url: env.API_BASE_URL + '/api/wechat/refresh',
        data: { refresh_token: refreshToken },
        success: r => {
            const data = r.data || {};
            if (r.statusCode === 200 && data.access_token) {
                // 更新两种令牌
                wx.setStorageSync('access_token', data.access_token);
                wx.setStorageSync('refresh_token', data.refresh_token);
                cb(data.access_token);
            } else {
                // 刷新失败，清除旧令牌并重新登录
                resetTokensAndLogin(cb);
            }
        },
        fail: () => {
            // 请求失败，重新登录
            resetTokensAndLogin(cb);
        }
    })
}

// 令牌失效时：优先刷新，没有刷新令牌则重新登录
// 并发请求共用同一次刷新，避免互相覆盖新令牌
let refreshing = false;
let refreshWaiters = [];

function handleAuthFailure(retry) {
    refreshWaiters.push(retry);
    if (refreshing) return;
    refreshing = true;

    const done = () => {
        const waiters = refreshWaiters;
        refreshWaiters = [];
        refreshing = false;
        waiters.forEach(fn => fn());
    };

    const refreshToken = wx.getStorageSync('refresh_token');
    if (refreshToken) {
        refreshAccessToken(refreshToken, done);
    } else {
        wxLogin(done);
    }
}

// 包装wx.request，自动处理令牌刷新
function request(options, retried) {
    getOrRefreshToken(token => {
        wx.request({
            ...options,
            header: {
                ...(options.header || {}),
                Authorization: 'Bearer ' + token
            },
            fail: options.fail,
            success: (res) => {
                if(res.statusCode === 429){
                    wx.showToast({
                        title: '请求过多请稍后',
                        icon: 'error'
                    });
                    return;
                }
                // 令牌失效时刷新并重试一次，避免死循环
                if (res.statusCode === 401 && !retried) {
                    handleAuthFailure(() => request(options, true));
                    return;
                }
                // 正常响应
                if (options.success) {
                    options.success(res);
                }
            },
            complete: options.complete
        });
    });
}
function uploadFile(options, retried) {
    getOrRefreshToken(token => {
        wx.uploadFile({
            ...options,
            header: {
                ...(options.header || {}),
                Authorization: 'Bearer ' + token
            },
            fail: options.fail,
            success: (res) => {
                // 令牌失效时刷新并重试一次，避免死循环
                if (res.statusCode === 401 && !retried) {
                    handleAuthFailure(() => uploadFile(options, true));
                    return;
                }
                // 正常响应
                if (options.success) {
                    options.success(res);
                }
            },
            complete: options.complete
        });
    });
}
// 检查是否已绑定
function checkBindAndRedirect() {
    request({
        url: env.API_BASE_URL + '/api/wechat/isbound',
        success: res => {
            if (res.errMsg) {
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
        request: request,
        uploadFile:uploadFile
    },// 导出包装后的请求函数

    onLaunch() {
        checkBindAndRedirect();
        console.log('当前环境:', env.ENV_TYPE);
        console.log('API地址:', env.API_BASE_URL);
    }
});