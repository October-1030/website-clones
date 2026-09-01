# AuthForm specification

Target: src/components/auth-form.tsx. Click and input driven. References: original-login-desktop.png, original-register-desktop.png, original-login-validation.png.
Heading 30px/45px black weight500 mb35px. Text 必火GEO营销登录; registration 手机号注册.
Login account placeholder 请输入用户账号; password 请输入账号密码. Fields height46px rounded23px bgwhite border1px rgba(15,23,42,.15) px18px; content14px/34px #2d3748; placeholder#9ca3af. Field spacing18px.
Errors absolute below fields padding-top2px,12px #ff4d4f; empty account 请输入用户账号, empty password 请输入密码. No layout shift.
Visibility icon when password nonempty; use extracted SVG from icons.tsx.
Locale switch after fields; action margin-top24px height46px primary #bc1f1a text15px weight500, rounded23px. Hover #d0625e translateY(-1px) shadow0 4px 12px #5a8bff59 transition.3s.
Alternate link centered mt20px 14px/20px; muted prompt 还没有账号？, primary 注册. Hash #/auth/register.
Registration: phone max11 placeholder请输入手机号; code max6 placeholder请输入验证码; 获取验证码 button disabled on invalid phone,13px px14px rounded23px white, code row flex gap10px. Password placeholder请输入密码（6-20位，需包含字母和数字）. Action 注册. Alternate 已有账号？ 去登录. No language switch.
Fields and actions adapt to shell width. Clone validates locally; no account, password, or SMS data is ever sent or stored. Successful client validation opens an explicit demo notice, not a fake authenticated dashboard. Code requests use labeled local test code123456.
