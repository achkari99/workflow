import type { Express, Request } from "express";
import { pool } from "../db";
import { isAuthenticated } from "../auth";

type WorkingHoursRange = "Day" | "Week" | "Month";

function getUserId(req: Request): string | undefined {
  return (req.user as any)?.id;
}

function getRange(value: unknown): WorkingHoursRange {
  return value === "Week" || value === "Month" ? value : "Day";
}

export function registerAnalyticsRoutes(app: Express) {
  app.get("/api/profile/working-hours", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const range = getRange(req.query.range);
      const data =
        range === "Month"
          ? await getMonthlyWorkingHours(userId)
          : range === "Week"
            ? await getWeeklyWorkingHours(userId)
            : await getDailyWorkingHours(userId);

      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch working hours" });
    }
  });
}

async function getDailyWorkingHours(userId: string) {
  const { rows } = await pool.query(
    `
    with days as (
      select generate_series(current_date - interval '6 days', current_date, interval '1 day')::date as bucket
    )
    select
      to_char(days.bucket, 'Dy') as label,
      to_char(days.bucket, 'FMMonth DD, YYYY') as date,
      round((coalesce(sum(working_hour_entries.minutes), 0)::numeric / 60), 1)::float as hours
    from days
    left join working_hour_entries
      on working_hour_entries.work_date = days.bucket
      and working_hour_entries.user_id = $1
    group by days.bucket
    order by days.bucket;
    `,
    [userId],
  );
  return rows;
}

async function getWeeklyWorkingHours(userId: string) {
  const { rows } = await pool.query(
    `
    with weeks as (
      select generate_series(
        date_trunc('week', current_date)::date - interval '3 weeks',
        date_trunc('week', current_date)::date,
        interval '1 week'
      )::date as bucket
    )
    select
      to_char(weeks.bucket, 'Mon DD') as label,
      to_char(weeks.bucket, 'FMMonth DD, YYYY') || ' - ' || to_char((weeks.bucket + interval '6 days')::date, 'FMMonth DD, YYYY') as date,
      round((coalesce(sum(working_hour_entries.minutes), 0)::numeric / 60), 1)::float as hours
    from weeks
    left join working_hour_entries
      on working_hour_entries.work_date >= weeks.bucket
      and working_hour_entries.work_date < weeks.bucket + interval '1 week'
      and working_hour_entries.user_id = $1
    group by weeks.bucket
    order by weeks.bucket;
    `,
    [userId],
  );
  return rows;
}

async function getMonthlyWorkingHours(userId: string) {
  const { rows } = await pool.query(
    `
    with months as (
      select generate_series(
        date_trunc('month', current_date)::date - interval '5 months',
        date_trunc('month', current_date)::date,
        interval '1 month'
      )::date as bucket
    )
    select
      to_char(months.bucket, 'Mon') as label,
      to_char(months.bucket, 'FMMonth YYYY') as date,
      round((coalesce(sum(working_hour_entries.minutes), 0)::numeric / 60), 1)::float as hours
    from months
    left join working_hour_entries
      on working_hour_entries.work_date >= months.bucket
      and working_hour_entries.work_date < months.bucket + interval '1 month'
      and working_hour_entries.user_id = $1
    group by months.bucket
    order by months.bucket;
    `,
    [userId],
  );
  return rows;
}
