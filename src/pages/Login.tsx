import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { wallpapers, user } from "~/configs";
import type { MacActions } from "~/types";
import { loginAlign } from "~/services";
import { encrypt } from "~/services/encrypt";
import type { UserInfo } from "~/stores/slices/user";

type SignState =
  | { type: "idle"; text: string }
  | { type: "loading"; text: string }
  | { type: "error"; text: string };

export default function Login(props: MacActions) {
  const [password, setPassword] = useState("");
  const [sign, setSign] = useState<SignState>({
    type: "idle",
    text: "Enter Password"
  });
  // 每次进入错误态自增，强制重新触发 shake 动画（同态连续错误也能抖）
  const [shakeKey, setShakeKey] = useState(0);
  // 长按密码框显示明文（参照 macOS 钥匙串弹窗的 press-and-hold 显隐交互）
  const [showPassword, setShowPassword] = useState(false);
  const [bgLoaded, setBgLoaded] = useState(false);
  const dark = useStore((state) => state.dark);
  const customWallpaper = useStore((state) => state.customWallpaper);
  const preloadedWallpapers = useStore((state) => state.preloadedWallpapers);
  const setUserInfo = useStore((state) => state.setUserInfo);

  const loading = sign.type === "loading";

  const triggerError = (text: string) => {
    setSign({ type: "error", text });
    setShakeKey((k) => k + 1);
  };

  // 长按密码框显示明文（参照 macOS 钥匙串弹窗的 press-and-hold 显隐交互）
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPeek = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => setShowPassword(true), 400);
  };
  const endPeek = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    setShowPassword(false);
  };
  useEffect(() => () => endPeek(), []);

  // 免登校验（authAlign）已移至 boot 序列，Login 只负责密码登录

  const keyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") loginHandle();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setPassword(e.target.value);
    // 输入时如果还在错误态，恢复到 idle
    if (sign.type === "error") {
      setSign({ type: "idle", text: "Enter Password" });
    }
  };

  const loginHandle = () => {
    if (loading) return;
    if (!password) {
      triggerError("Enter Password");
      return;
    }

    setSign({ type: "loading", text: "Logging in..." });

    const data = new FormData();
    data.append("user", encrypt({ username: user.username, password }));

    loginAlign(data)
      .then((res) => {
        if (res?.data && typeof res.data === "object") {
          setUserInfo(res.data as UserInfo);
          props.setLogin(true);
        } else {
          triggerError("Incorrect password");
          setPassword("");
        }
      })
      .catch(() => {
        triggerError("Incorrect password");
        setPassword("");
      });
  };

  // 壁纸 URL（自定义优先，否则按深色模式取默认；boot 阶段已预加载）
  const bgUrl = customWallpaper ?? (dark ? wallpapers.night : wallpapers.day);
  // 优先用 boot 预加载的 blob URL（内存引用，不走网络，绝不流式）
  const bgSrc = preloadedWallpapers[bgUrl] ?? bgUrl;
  useEffect(() => {
    setBgLoaded(Boolean(preloadedWallpapers[bgUrl]));
  }, [bgUrl, preloadedWallpapers]);

  // macOS 登录页错误抖动：整体左右晃几次后回正
  const shakeVariants = {
    shake: {
      x: [0, -8, 8, -6, 6, -3, 3, 0],
      transition: { duration: 0.5, ease: "easeInOut" }
    }
  };

  // 提示文字颜色：错误态偏红，其余白色半透明
  const signColor = sign.type === "error" ? "text-red-400" : "text-white/70";

  return (
    <div className="size-full login text-center relative overflow-hidden">
      {/* 壁纸层：onLoad 前隐藏，加载完一次性显示（boot 已预加载，几乎立即 onLoad）
          滤镜模拟 macOS 登录窗：重度高斯模糊 + 压暗，浅色壁纸下白色文字也清晰 */}
      <img
        src={bgSrc}
        alt=""
        aria-hidden
        decoding="sync"
        onLoad={() => setBgLoaded(true)}
        className="absolute inset-0 size-full object-cover transition-opacity duration-300"
        style={{
          opacity: bgLoaded ? 1 : 0,
          filter: "brightness(0.5) blur(20px)",
          transform: "scale(1.1)"
        }}
      />
      {/* 内容层 */}
      <div className="relative size-full">
        <motion.div
          key={shakeKey}
          className="inline-block w-auto relative top-1/2 -mt-40"
          initial={false}
          animate={sign.type === "error" ? "shake" : false}
          variants={shakeVariants}
        >
          {/* Avatar */}
          <img
            className="rounded-full size-24 my-0 mx-auto"
            src={user.avatar}
            alt="img"
          />
          <div className="font-semibold mt-2 text-xl text-white">{user.name}</div>

          {/* Password Input */}
          <div
            className={`mx-auto grid grid-cols-5 w-44 h-8 mt-4 rounded-md backdrop-blur-2xl bg-gray-300/50 overflow-hidden transition-shadow ${
              showPassword
                ? "ring-2 ring-blue-400/60 shadow-[0_0_8px_rgba(96,165,250,0.4)]"
                : ""
            }`}
          >
            <input
              className="text-sm text-white col-start-1 col-span-4 no-outline bg-transparent px-2 disabled:opacity-60 select-none"
              type={showPassword ? "text" : "password"}
              placeholder="Enter Password"
              disabled={loading}
              autoFocus
              onKeyDown={keyPress}
              value={password}
              onChange={handleInputChange}
              // 长按 400ms 显示明文，松开恢复（macOS 钥匙串式 press-and-hold）
              onMouseDown={startPeek}
              onMouseUp={endPeek}
              onMouseLeave={endPeek}
              onTouchStart={startPeek}
              onTouchEnd={endPeek}
            />
            <div className="col-start-5 col-span-1 flex-center">
              <AnimatePresence mode="wait" initial={false}>
                {loading ? (
                  <motion.span
                    key="spinner"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      rotate: 360
                    }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{
                      opacity: { duration: 0.15 },
                      scale: { duration: 0.15 },
                      rotate: {
                        duration: 0.8,
                        ease: "linear",
                        repeat: Infinity
                      }
                    }}
                    className="i-bi:arrow-right-circle text-white text-lg"
                  />
                ) : (
                  <motion.button
                    key="arrow"
                    type="button"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.15 }}
                    className="text-white hover:opacity-80"
                    onClick={loginHandle}
                  >
                    <span className="i-bi:arrow-right-circle-fill text-lg" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* 提示文字：淡入淡出切换 */}
          <div className="mt-2 h-5 overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={sign.text + sign.type}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className={`text-sm ${signColor}`}
              >
                {sign.text}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* buttons */}
        <div className="text-sm fixed bottom-16 inset-x-0 mx-auto flex flex-row space-x-4 w-max">
          <div
            className="hstack flex-col text-white w-24 cursor-pointer"
            onClick={(e) => props.sleepMac(e)}
          >
            <div className="flex-center size-10 bg-gray-700 rounded-full">
              <span className="i-gg:sleep text-[40px]" />
            </div>
            <span>Sleep</span>
          </div>
          <div
            className="hstack flex-col text-white w-24 cursor-pointer"
            onClick={(e) => props.restartMac(e)}
          >
            <div className="flex-center size-10 bg-gray-700 rounded-full">
              <span className="i-ri:restart-line text-4xl" />
            </div>
            <span>Restart</span>
          </div>
          <div
            className="hstack flex-col text-white w-24 cursor-pointer"
            onClick={(e) => props.shutMac(e)}
          >
            <div className="flex-center size-10 bg-gray-700 rounded-full">
              <span className="i-ri:shut-down-line text-4xl" />
            </div>
            <span>Shut Down</span>
          </div>
        </div>
      </div>
    </div>
  );
}
