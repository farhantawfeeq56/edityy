"use client";

import { Puck, type Config, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

type Components = {
  Heading: { text: string };
  Text: { text: string };
};

const config: Config<Components> = {
  components: {
    Heading: {
      fields: { text: { type: "text" } },
      defaultProps: { text: "Heading" },
      render: ({ text }) => <h2>{text}</h2>,
    },
    Text: {
      fields: { text: { type: "textarea" } },
      defaultProps: { text: "Some text." },
      render: ({ text }) => <p>{text}</p>,
    },
  },
};

const initialData: Data<Components> = {
  root: { props: {} },
  content: [
    { type: "Heading", props: { id: "heading-1", text: "Hello from Puck" } },
    { type: "Text", props: { id: "text-1", text: "Drag components in from the left." } },
  ],
};

export function PuckEditor() {
  // In-memory only: publishing just logs the data.
  return <Puck config={config} data={initialData} onPublish={(data) => console.log("[playground] puck", data)} />;
}

export function TiptapEditor() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: "<h2>Hello from Tiptap</h2><p>Type here. <strong>Bold</strong>, lists and headings work.</p>",
    // The page is server-rendered; rendering the editor before hydration would mismatch.
    immediatelyRender: false,
  });

  return <EditorContent editor={editor} className="min-h-64 border border-neutral-300 bg-white p-3" />;
}
