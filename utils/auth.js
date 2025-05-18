// 检查本地是否有token，无则wx.login换取之
function getOrLoginToken(cb) {
    let token = wx.getStorageSync('token');
    if (token) {
        cb(token);
    } else {
        wx.login({
            success: res => {
                wx.request({
                    method: "POST",
                    url: 'http://127.0.0.1:8000/api/wechat/login',
                    data: { code: res.code },
                    success: r => {
                        wx.setStorageSync('token', r.data.token);
                        cb(r.data.token);
                    }
                })
            }
        })
    }
}

// 检查是否已绑定
function checkBindAndRedirect() {
    getOrLoginToken(token => {
        wx.request({
            url: 'http://127.0.0.1:8000/api/wechat/isbound',
            header: { Authorization: 'Bearer ' + token },
            success: res => {
                if (res.data.is_bound) {
                    wx.redirectTo({ url: '/pages/songrequest/songrequest' });
                } else {
                    wx.redirectTo({ url: '/pages/bind/bind' });
                }
            }
        })
    })
}

module.exports = {
    getOrLoginToken,
    checkBindAndRedirect
}