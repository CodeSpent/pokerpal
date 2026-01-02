CREATE TABLE "actions" (
	"id" text PRIMARY KEY NOT NULL,
	"hand_id" text NOT NULL,
	"player_id" text NOT NULL,
	"seat_index" integer NOT NULL,
	"action_type" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"phase" text NOT NULL,
	"sequence" integer NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "early_start_votes" (
	"id" text PRIMARY KEY NOT NULL,
	"tournament_id" text NOT NULL,
	"player_id" text NOT NULL,
	"voted_at" integer NOT NULL,
	CONSTRAINT "uniq_vote_tournament_player" UNIQUE("tournament_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" text NOT NULL,
	"entity_version" integer NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hands" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"table_id" text NOT NULL,
	"hand_number" integer NOT NULL,
	"phase" text DEFAULT 'dealing' NOT NULL,
	"dealer_seat" integer NOT NULL,
	"small_blind_seat" integer NOT NULL,
	"big_blind_seat" integer NOT NULL,
	"current_actor_seat" integer,
	"current_bet" integer DEFAULT 0 NOT NULL,
	"min_raise" integer NOT NULL,
	"pot" integer DEFAULT 0 NOT NULL,
	"community_cards" text DEFAULT '[]' NOT NULL,
	"deck" text NOT NULL,
	"action_deadline" integer,
	"showdown_started_at" integer,
	"started_at" integer NOT NULL,
	"ended_at" integer
);
--> statement-breakpoint
CREATE TABLE "migrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"applied_at" integer NOT NULL,
	CONSTRAINT "migrations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"avatar" text,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pots" (
	"id" text PRIMARY KEY NOT NULL,
	"hand_id" text NOT NULL,
	"amount" integer NOT NULL,
	"eligible_players" text NOT NULL,
	"pot_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "showdown_results" (
	"id" text PRIMARY KEY NOT NULL,
	"hand_id" text NOT NULL,
	"player_id" text NOT NULL,
	"seat_index" integer NOT NULL,
	"hand_rank" text NOT NULL,
	"hand_description" text NOT NULL,
	"best_hand" text NOT NULL,
	"winnings" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_players" (
	"id" text PRIMARY KEY NOT NULL,
	"table_id" text NOT NULL,
	"player_id" text NOT NULL,
	"seat_index" integer NOT NULL,
	"stack" integer NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"current_bet" integer DEFAULT 0 NOT NULL,
	"hole_card_1" text,
	"hole_card_2" text,
	CONSTRAINT "uniq_table_seat" UNIQUE("table_id","seat_index"),
	CONSTRAINT "uniq_table_player" UNIQUE("table_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"tournament_id" text NOT NULL,
	"table_number" integer NOT NULL,
	"max_seats" integer DEFAULT 9 NOT NULL,
	"dealer_seat" integer DEFAULT 0 NOT NULL,
	"small_blind" integer NOT NULL,
	"big_blind" integer NOT NULL,
	"ante" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"tournament_id" text NOT NULL,
	"player_id" text NOT NULL,
	"registered_at" integer NOT NULL,
	CONSTRAINT "uniq_tournament_player" UNIQUE("tournament_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'registering' NOT NULL,
	"name" text NOT NULL,
	"creator_id" text NOT NULL,
	"max_players" integer DEFAULT 9 NOT NULL,
	"table_size" integer DEFAULT 9 NOT NULL,
	"starting_chips" integer DEFAULT 1500 NOT NULL,
	"blind_structure" text DEFAULT 'standard' NOT NULL,
	"blind_level_minutes" integer DEFAULT 10 NOT NULL,
	"turn_timer_seconds" integer DEFAULT 30,
	"current_level" integer DEFAULT 1 NOT NULL,
	"level_started_at" integer,
	"players_remaining" integer DEFAULT 0 NOT NULL,
	"prize_pool" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL,
	"started_at" integer,
	"ended_at" integer
);
--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_hand_id_hands_id_fk" FOREIGN KEY ("hand_id") REFERENCES "public"."hands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "early_start_votes" ADD CONSTRAINT "early_start_votes_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "early_start_votes" ADD CONSTRAINT "early_start_votes_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hands" ADD CONSTRAINT "hands_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pots" ADD CONSTRAINT "pots_hand_id_hands_id_fk" FOREIGN KEY ("hand_id") REFERENCES "public"."hands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showdown_results" ADD CONSTRAINT "showdown_results_hand_id_hands_id_fk" FOREIGN KEY ("hand_id") REFERENCES "public"."hands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showdown_results" ADD CONSTRAINT "showdown_results_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_players" ADD CONSTRAINT "table_players_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_players" ADD CONSTRAINT "table_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_creator_id_players_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_actions_hand" ON "actions" USING btree ("hand_id");--> statement-breakpoint
CREATE INDEX "idx_events_entity" ON "events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_events_created" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_hands_table" ON "hands" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "idx_table_players_table" ON "table_players" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "idx_table_players_player" ON "table_players" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "idx_tables_tournament" ON "tables" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "idx_registrations_tournament" ON "tournament_registrations" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "idx_registrations_player" ON "tournament_registrations" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "idx_tournaments_status" ON "tournaments" USING btree ("status");