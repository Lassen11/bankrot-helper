
-- Template stages for new client cabinets
CREATE TABLE public.cabinet_template_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_number integer NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(stage_number)
);

ALTER TABLE public.cabinet_template_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage template stages"
ON public.cabinet_template_stages
FOR ALL TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "All authenticated can read template stages"
ON public.cabinet_template_stages
FOR SELECT TO authenticated
USING (true);

-- Template team for new client cabinets
CREATE TABLE public.cabinet_template_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  role_label text,
  bio text,
  avatar_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cabinet_template_team ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage template team"
ON public.cabinet_template_team
FOR ALL TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "All authenticated can read template team"
ON public.cabinet_template_team
FOR SELECT TO authenticated
USING (true);

-- Seed default stages
INSERT INTO public.cabinet_template_stages (stage_number, title, description) VALUES
(1, 'Сбор документов и изучение материала', E'Сбор и подготовка первичных документов для процедуры списания долгов\nВам необходимо детально изучить памятку что можно, а что нельзя делать при прохождении процедуры списания долгов для этого нажмите на ссылку\nhttps://pamyatka-bfl.delobusiness-it.ru/'),
(2, 'Анализ финансового состояния', E'Анализ доходов, расходов и долговой нагрузки и всей кредитной истории.\nСоздаем документ для отзыва ваших персональных данных от кредиторов'),
(3, 'Сбор второго пакета документов', E'Формируем ЛКН\nЗапросы в ФНС, ГиБДД, Росреестр.\nЮридический отдел анализирует всю документацию, при наличии дополнительного имущества защищаем его'),
(4, 'Первичная работа с кредиторами', E'Официально уведомляем ваших кредиторов о прохождении процедуры списания всех долгов\nСобираем необходимый пакет документов по вашему супругу/супруге для защиты имущества'),
(5, 'Подготовка заявления в суд', 'Составление заявления о признании банкротом'),
(6, 'Подача заявления в Арбитражный суд', 'Рассмотрение дела о банкротстве в суде'),
(7, 'Первое судебное заседание', E'Рассмотрение дела о банкротстве в суде\nНазначение финансового управляющего'),
(8, 'Работа с государственными органами', 'Отправка запросов, Получение ответов и работа с ними'),
(9, 'Работа с кредиторами', E'Взаимодействие с кредиторами и рассмотрение их требований\nФормирование и утверждение реестра требований кредиторов'),
(10, 'Промежуточный отчет Арбитражного управляющего', 'Направляем отчет от нашего Арбитражного управляющего, о успешном прохождении процедуры списания долгов'),
(11, 'Завершение процедуры реализации', 'Подготовка отчёта и завершение процедуры реализации'),
(12, 'Списание долгов и закрытие дела', 'Суд выносит определение о списании долгов');

-- Seed default team
INSERT INTO public.cabinet_template_team (full_name, role_label, bio, avatar_url, sort_order) VALUES
('Гоннова Анастасия Сергеевна', 'Квалифицированный юрист в банкротстве физических лиц', 'Защищает интересы клиента в ходе всей процедуры', 'https://gidvpxxfgvivjbzfpxcg.supabase.co/storage/v1/object/public/avatars/team/622ec1a7-e3ba-4088-9c47-fae168d86421/ff73edb2-37bf-4d7b-8d80-2943cd15c686.jpg', 1),
('Эркенова Марианна Казимовна', 'Арбитражный Управляющий', 'Ведет ваше дело в арбитражном суде', 'https://gidvpxxfgvivjbzfpxcg.supabase.co/storage/v1/object/public/avatars/team/622ec1a7-e3ba-4088-9c47-fae168d86421/2ec5d944-0776-4b28-a17a-9a528af703e5.jpg', 2);
