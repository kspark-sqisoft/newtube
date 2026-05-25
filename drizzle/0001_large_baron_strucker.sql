CREATE INDEX "comment_reactions_comment_id_idx" ON "comment_reactions" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "comments_video_id_created_at_idx" ON "comments" USING btree ("video_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_parent_id_idx" ON "comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "comments_user_id_idx" ON "comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "playlist_videos_video_id_idx" ON "playlist_videos" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "playlists_user_id_updated_at_idx" ON "playlists" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "subscriptions_creator_id_idx" ON "subscriptions" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "video_reactions_video_id_type_idx" ON "video_reactions" USING btree ("video_id","type");--> statement-breakpoint
CREATE INDEX "video_views_video_id_idx" ON "video_views" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "videos_user_id_updated_at_idx" ON "videos" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "videos_category_id_idx" ON "videos" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "videos_visibility_updated_at_idx" ON "videos" USING btree ("visibility","updated_at");