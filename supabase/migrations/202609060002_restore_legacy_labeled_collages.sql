-- Earlier demo-era collage cards were manually labelled, but an obsolete
-- "single image only" rule left them rejected. Restore only those records:
-- unanalysed assets (empty classification_note) remain pending for AI analysis.
update public.assets
set review_status = 'available'::public.asset_review_status
where visual_format in ('single'::public.asset_visual_format, 'collage'::public.asset_visual_format)
  and review_status in ('pending'::public.asset_review_status, 'rejected'::public.asset_review_status)
  and classification_note like '图片识别：%'
  and cardinality(tags) > 0;
