## 推送方式：SSH（推荐，国内免梯子）

GitHub 的 HTTPS 在部分网络下会被重置，改用 **SSH over 443** 就通了。

### 已经配好的（这台机器）

```
~/.ssh/id_ed25519        私钥
~/.ssh/config            github.com → ssh.github.com:443
remote = git@github.com:luoyeZzz/luoyeZzz.github.io.git
```

工具里「发布」的仓库地址保持这个 SSH 地址，**令牌留空**。

#