-- 010_clear_display_names.sql
-- display_name 컬럼은 어드민에서 직접 관리하는 값으로,
-- 잘못 입력된 기존 데이터를 모두 NULL로 초기화합니다.

UPDATE places SET display_name = NULL WHERE display_name IS NOT NULL;
UPDATE routes SET display_name = NULL WHERE display_name IS NOT NULL;
