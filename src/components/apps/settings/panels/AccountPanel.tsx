import React from "react";
import { user } from "~/configs";
import {
  getSingleton,
  writeSingleton,
  hasPat,
  onQueueStatus,
  hasPending
} from "~/services/database";
import { useStore } from "~/stores";
import AccountField from "./AccountField";

/** user:profile 单例的数据结构 */
interface UserProfile {
  name: string;
  autograph: string;
  intr: string;
  gender: string;
  wechat: string;
  QQ: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "failed";

/** Apple ID 账户页：编辑用户信息，失焦自动保存到 database */
const AccountPanel = React.memo(function AccountPanel() {
  const userInfo = useStore((s) => s.userInfo);
  const pushNotification = useStore((s) => s.pushNotification);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");

  // 初始加载：getSingleton 读取，空则 fallback 到 userInfo + configs user
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rec = await getSingleton<UserProfile>("user:profile");
      if (cancelled) return;
      if (rec?.data) {
        setProfile(rec.data);
      } else {
        setProfile({
          name: userInfo?.username || user.name,
          autograph: userInfo?.autograph || "",
          intr: userInfo?.intr || "",
          gender: userInfo?.gender || "",
          wechat: userInfo?.wechat || "",
          QQ: userInfo?.QQ || ""
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userInfo]);

  // 订阅 database 队列状态
  useEffect(() => {
    const unsub = onQueueStatus((running) => {
      if (running) {
        setStatus("saving");
      } else {
        // flush 结束：PAT 缺失时任务被丢弃，hasPending() 为 false，
        // 但写入实际失败——用 hasPat() 区分真实状态
        if (!hasPat()) {
          setStatus("failed");
        } else {
          setStatus(hasPending() ? "failed" : "saved");
          if (!hasPending()) {
            setTimeout(() => setStatus("idle"), 1500);
          }
        }
      }
    });
    return unsub;
  }, []);

  const handleFieldBlur = (field: keyof UserProfile, value: string) => {
    if (!profile) return;
    const next = { ...profile, [field]: value };
    setProfile(next);
    writeSingleton("user:profile", next);

    // PAT 缺失：直接标记失败 + 触发系统通知
    if (!hasPat()) {
      setStatus("failed");
      pushNotification({
        title: "GitHub PAT Required",
        body: "Configure your GitHub token in Privacy & Security to persist settings.",
        appId: "settings",
        sidebarItemId: "privacy"
      });
    }
  };

  if (!profile) {
    return (
      <div className="flex-1 flex-center">
        <span className="i-bi:arrow-repeat animate-spin text-2xl text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-7 py-6 relative">
      <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-1">
        Apple ID
      </h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
        Manage your profile information.
      </p>

      {/* 顶部账户区：大头像 + 姓名 + 个签 */}
      <div className="flex items-center gap-4 mb-6">
        <img
          src={user.avatar}
          alt={profile.name}
          className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-zinc-600 shadow-sm"
        />
        <div className="flex-1 min-w-0">
          <div className="text-lg font-semibold text-gray-800 dark:text-gray-100 truncate">
            {profile.name}
          </div>
          {profile.autograph && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {profile.autograph}
            </div>
          )}
        </div>
      </div>

      {/* 个人信息卡片 */}
      <div className="rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-700">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Personal Information
          </span>
        </div>
        <AccountField
          label="Name"
          value={profile.name}
          onBlur={(v) => handleFieldBlur("name", v)}
        />
        <AccountField
          label="Autograph"
          value={profile.autograph}
          onBlur={(v) => handleFieldBlur("autograph", v)}
          placeholder="A short tagline about yourself"
        />
        <AccountField
          label="Bio"
          value={profile.intr}
          onBlur={(v) => handleFieldBlur("intr", v)}
          multiline
          placeholder="Tell something about yourself"
        />
        <AccountField
          label="Gender"
          value={profile.gender}
          onBlur={(v) => handleFieldBlur("gender", v)}
        />
        <AccountField
          label="WeChat"
          value={profile.wechat}
          onBlur={(v) => handleFieldBlur("wechat", v)}
        />
        <AccountField
          label="QQ"
          value={profile.QQ}
          onBlur={(v) => handleFieldBlur("QQ", v)}
        />
      </div>

      {/* 保存状态指示（右下角） */}
      {status !== "idle" && (
        <div className="sticky bottom-0 right-0 flex justify-end py-2">
          <span
            className={`text-xs px-2.5 py-1 rounded-md backdrop-blur ${
              status === "saving"
                ? "text-gray-600 dark:text-gray-300 bg-gray-100/80 dark:bg-zinc-700/80"
                : status === "saved"
                  ? "text-green-600 dark:text-green-400 bg-green-50/80 dark:bg-green-900/30"
                  : "text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-900/30"
            }`}
          >
            {status === "saving"
              ? "Saving…"
              : status === "saved"
                ? "Saved"
                : "Save failed"}
          </span>
        </div>
      )}
    </div>
  );
});

export default AccountPanel;
