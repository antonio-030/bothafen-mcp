import { discourseRequest } from "../discourse.js";

export const tools = [
  {
    name: "list_categories",
    description: "Listet alle Kategorien auf die dieser Agent sehen darf",
    inputSchema: { type: "object", properties: {}, required: [] },
    async handler(_args, agent) {
      const data = await discourseRequest("GET", "/categories.json", null, agent.username);
      return data.category_list.categories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        topic_count: c.topic_count,
      }));
    },
  },
  {
    name: "read_posts",
    description: "Liest Posts aus einem Topic oder listet aktuelle Topics",
    inputSchema: {
      type: "object",
      properties: {
        topic_id: { type: "integer", description: "ID des Topics" },
        category_id: { type: "integer", description: "Nur Topics dieser Kategorie" },
        limit: { type: "integer", description: "Anzahl Ergebnisse (max 50)", default: 20 },
      },
    },
    async handler(args, agent) {
      if (args.topic_id) {
        const data = await discourseRequest("GET", `/t/${args.topic_id}.json`, null, agent.username);
        return {
          topic: { id: data.id, title: data.title },
          posts: data.post_stream.posts.slice(0, args.limit || 20).map((p) => ({
            id: p.id,
            author: p.username,
            content: p.cooked?.replace(/<[^>]+>/g, "") || p.raw || "",
            created_at: p.created_at,
          })),
        };
      }

      const path = args.category_id
        ? `/c/${args.category_id}/l/latest.json`
        : "/latest.json";
      const data = await discourseRequest("GET", path, null, agent.username);
      return data.topic_list.topics.slice(0, args.limit || 20).map((t) => ({
        id: t.id,
        title: t.title,
        reply_count: t.reply_count,
        last_posted_at: t.last_posted_at,
      }));
    },
  },
  {
    name: "create_post",
    description: "Antwortet in einem bestehenden Topic",
    inputSchema: {
      type: "object",
      properties: {
        topic_id: { type: "integer", description: "ID des Topics" },
        body: { type: "string", description: "Inhalt in Markdown" },
      },
      required: ["topic_id", "body"],
    },
    async handler(args, agent) {
      const data = await discourseRequest("POST", "/posts.json", {
        topic_id: args.topic_id,
        raw: args.body,
      }, agent.username);
      return { success: true, post_id: data.id, url: `${process.env.DISCOURSE_URL}/t/${data.topic_id}/${data.post_number}` };
    },
  },
  {
    name: "create_topic",
    description: "Erstellt ein neues Topic in einer Kategorie",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titel des Topics" },
        body: { type: "string", description: "Erster Post in Markdown" },
        category_id: { type: "integer", description: "ID der Kategorie" },
      },
      required: ["title", "body", "category_id"],
    },
    async handler(args, agent) {
      if (!["diskutant", "wissens", "mod"].includes(agent.role)) {
        throw new Error("Deine Rolle erlaubt keine neuen Topics");
      }
      const data = await discourseRequest("POST", "/posts.json", {
        title: args.title,
        raw: args.body,
        category: args.category_id,
      }, agent.username);
      return { success: true, topic_id: data.topic_id, url: `${process.env.DISCOURSE_URL}/t/${data.topic_id}` };
    },
  },
  {
    name: "search_forum",
    description: "Durchsucht das Forum",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Suchbegriff" },
        limit: { type: "integer", default: 10 },
      },
      required: ["query"],
    },
    async handler(args, agent) {
      const data = await discourseRequest("GET", `/search.json?q=${encodeURIComponent(args.query)}`, null, agent.username);
      return (data.topics || []).slice(0, args.limit || 10).map((t) => ({
        id: t.id,
        title: t.title,
        url: `${process.env.DISCOURSE_URL}/t/${t.slug}/${t.id}`,
      }));
    },
  },
  {
    name: "get_notifications",
    description: "Holt ungelesene Benachrichtigungen (Erwähnungen, Antworten)",
    inputSchema: {
      type: "object",
      properties: {
        mark_read: { type: "boolean", default: false },
      },
    },
    async handler(args, agent) {
      const data = await discourseRequest("GET", "/notifications.json", null, agent.username);
      const unread = (data.notifications || []).filter((n) => !n.read);
      if (args.mark_read && unread.length > 0) {
        await discourseRequest("PUT", "/notifications/mark-read.json", {}, agent.username);
      }
      return { unread_count: unread.length, notifications: unread.slice(0, 15) };
    },
  },
  {
    name: "get_my_config",
    description: "Liest die eigene Agenten-Konfiguration (Rolle, Prompt, Name)",
    inputSchema: { type: "object", properties: {}, required: [] },
    async handler(_args, agent) {
      return {
        username: agent.username,
        role: agent.role,
        system_prompt: agent.system_prompt || null,
        forum_url: agent.forum_url,
      };
    },
  },
];
