import { Editor, rootCtx, defaultValueCtx } from "@milkdown/core";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import { history } from "@milkdown/plugin-history";
import { listener, listenerCtx } from "@milkdown/plugin-listener";

/** 通过 ref 暴露 setContent 给父组件（加载文件时替换内容） */
export interface EditorHandle {
  setContent: (md: string) => void;
}

interface MilkdownEditorProps {
  editorRef: React.MutableRefObject<EditorHandle | null>;
}

/** Milkdown 编辑器内部组件 */
const MilkdownEditor = ({ editorRef }: MilkdownEditorProps) => {
  const { typoraMd, setTyporaMd } = useStore((state) => ({
    typoraMd: state.typoraMd,
    setTyporaMd: state.setTyporaMd
  }));

  const editorApi = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, typoraMd);
        ctx
          .get(listenerCtx)
          .mounted((ctx) => {
            const wrapper = ctx.get(rootCtx) as HTMLDivElement;
            const editor = wrapper.querySelector(
              ".editor[role='textbox']"
            ) as HTMLDivElement;
            wrapper.onclick = () => editor?.focus();
          })
          .markdownUpdated((_, markdown) => setTyporaMd(markdown));

        root.className =
          "typora bg-white dark:bg-gray-800 text-c-700 h-full overflow-y-scroll";
      })
      .use(listener)
      .use(commonmark)
      .use(gfm)
      .use(history)
  );

  useEffect(() => {
    editorRef.current = {
      setContent: (md: string) => {
        const api = editorApi.get();
        if (api) {
          api.action((ctx) => {
            ctx.set(defaultValueCtx, md);
          });
          api.action((ctx) => {
            const editor = ctx.get(rootCtx) as HTMLDivElement;
            editor.innerHTML = "";
            Editor.make()
              .config((c) => {
                c.set(rootCtx, editor);
                c.set(defaultValueCtx, md);
                c.get(listenerCtx).markdownUpdated((_, m) => setTyporaMd(m));
              })
              .use(listener)
              .use(commonmark)
              .use(gfm)
              .use(history)
              .create();
          });
        }
      }
    };
  }, [editorApi, editorRef, setTyporaMd]);

  return <Milkdown />;
};

export default MilkdownEditor;
