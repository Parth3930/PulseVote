import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const polls = pgTable(
  "polls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    question: text("question").notNull(),
    creatorId: varchar("creator_id", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    createdAtIdx: index("polls_created_at_idx").on(table.createdAt),
  }),
);

export const options = pgTable(
  "options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    order: text("order").notNull(),
  },
  (table) => ({
    pollIdIdx: index("options_poll_id_idx").on(table.pollId),
  }),
);

export const votes = pgTable(
  "votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    optionId: uuid("option_id")
      .notNull()
      .references(() => options.id, { onDelete: "cascade" }),
    visitorId: varchar("visitor_id", { length: 255 }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    votedAt: timestamp("voted_at").notNull().defaultNow(),
  },
  (table) => ({
    pollIdIdx: index("votes_poll_id_idx").on(table.pollId),
    visitorIdIdx: index("votes_visitor_id_idx").on(table.visitorId),
    pollVisitorIdx: index("votes_poll_visitor_idx").on(
      table.pollId,
      table.visitorId,
    ),
  }),
);

export const pollsRelations = relations(polls, ({ many }) => ({
  options: many(options),
  votes: many(votes),
}));

export const optionsRelations = relations(options, ({ one, many }) => ({
  poll: one(polls, {
    fields: [options.pollId],
    references: [polls.id],
  }),
  votes: many(votes),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  poll: one(polls, {
    fields: [votes.pollId],
    references: [polls.id],
  }),
  option: one(options, {
    fields: [votes.optionId],
    references: [options.id],
  }),
}));
