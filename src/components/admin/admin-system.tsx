"use client";

import { AdminFeedback, useAdminAction } from "@/components/admin/admin-action";
import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useState } from "react";

import {
  getSiteSettingDefinition,
  SITE_SETTING_GROUPS,
  type SiteSettingDefinition,
} from "@/lib/site-setting-definitions";

type Setting = { key: string; value: string };
type Action = Record<string, unknown>;

function SettingControl({
  setting,
  definition,
  value,
  onChange,
}: {
  setting: Setting;
  definition: SiteSettingDefinition | null;
  value: string;
  onChange: (value: string) => void;
}) {
  const commonClassName = "w-full";
  if (definition?.type === "boolean" || definition?.type === "select") {
    return (
      <select
        className={`${commonClassName} h-10 rounded-4xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={definition.label}
      >
        {(definition.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <Input
      className={commonClassName}
      type={definition?.type === "number" ? "number" : "text"}
      value={value}
      min={definition?.min}
      max={definition?.max}
      step={definition?.step}
      onChange={(event) => onChange(event.target.value)}
      aria-label={definition?.label ?? setting.key}
    />
  );
}

export function AdminSystem({
  settings,
  recentActions,
  sensitiveKeys,
}: {
  settings: Setting[];
  recentActions: Action[];
  sensitiveKeys: string[];
}) {
  const { t } = useI18n();
  const { pending, error, message, run } = useAdminAction();
  const [values, setValues] = useState(() =>
    Object.fromEntries(settings.map((setting) => [setting.key, setting.value]))
  );
  const originalValues = Object.fromEntries(
    settings.map((setting) => [setting.key, setting.value])
  );
  const settingsByGroup = new Map<string, Setting[]>();
  for (const setting of settings) {
    const definition = getSiteSettingDefinition(setting.key);
    const group = definition?.group ?? "legacy";
    const groupSettings = settingsByGroup.get(group) ?? [];
    groupSettings.push(setting);
    settingsByGroup.set(group, groupSettings);
  }
  const groups = [
    ...SITE_SETTING_GROUPS,
    ...(settingsByGroup.has("legacy")
      ? [{ id: "legacy" as const, label: "Other / Legacy" }]
      : []),
  ].filter((group) => settingsByGroup.has(group.id));

  function updateValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function saveGroup(group: string) {
    const changed = (settingsByGroup.get(group) ?? []).reduce<Record<string, string>>(
      (result, setting) => {
        const value = values[setting.key] ?? "";
        if (value !== originalValues[setting.key]) result[setting.key] = value;
        return result;
      },
      {}
    );
    if (Object.keys(changed).length > 0) run("set_setting", { values: changed });
  }

  function runMaintenance(op: "backfill_translations") {
    if (
      window.confirm(
        "This operation may consume Worker, D1, or AI resources. Continue?"
      )
    ) {
      run(op, { limit: 100 });
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          System
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage site settings, bounded maintenance jobs, and administrator activity.
        </p>
      </section>
      <AdminFeedback error={error} message={message} />
      <nav
        aria-label="System sections"
        className="flex flex-wrap gap-2 text-sm"
      >
        {[
          ["#settings", "Settings"],
          ["#maintenance", "Maintenance"],
          ["#activity", "Activity"],
        ].map(([href, label]) => (
          <a
            key={href}
            className="rounded-4xl border border-border px-3 py-1.5 hover:bg-muted"
            href={href}
          >
            {label}
          </a>
        ))}
      </nav>
      {sensitiveKeys.length > 0 ? (
        <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <h2 className="font-semibold text-destructive">Sensitive settings detected</h2>
          <p className="mt-1 text-muted-foreground">
            These keys are hidden because secrets must be stored in environment bindings:{" "}
            <code className="font-mono">{sensitiveKeys.join(", ")}</code>
          </p>
        </section>
      ) : null}
      <section id="settings" className="space-y-6">
        <div>
          <h2 className="font-heading text-xl font-semibold">{t("admin.siteSettings")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Values are staged locally and only change after an explicit save.
          </p>
        </div>
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
                <h3 className="font-heading text-lg font-semibold">{group.label}</h3>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => saveGroup(group.id)}
                >
                  Save changes
                </Button>
              </div>
              <div className="grid gap-3">
                {(settingsByGroup.get(group.id) ?? []).map((setting) => {
                  const definition = getSiteSettingDefinition(setting.key);
                  return (
                    <article
                      key={setting.key}
                      className="grid gap-4 rounded-xl border border-border bg-card p-4 lg:grid-cols-[minmax(260px,1fr)_minmax(280px,480px)] lg:items-center"
                    >
                      <div className="min-w-0">
                        <h4 className="font-medium">
                          {definition?.label ?? "Unknown setting"}
                        </h4>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {definition?.description ??
                            "No metadata is defined for this setting yet."}
                        </p>
                        <code className="mt-2 block break-all font-mono text-xs text-muted-foreground">
                          Key: {setting.key}
                        </code>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <SettingControl
                          setting={setting}
                          definition={definition}
                          value={values[setting.key] ?? setting.value}
                          onChange={(value) => updateValue(setting.key, value)}
                        />
                        {definition?.unit ? (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {definition.unit}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
      <section id="maintenance" className="space-y-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">Maintenance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These operations may consume Worker, D1, or AI resources.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => runMaintenance("backfill_translations")}
          >
            {t("admin.backfillTranslations")}
          </Button>
        </div>
      </section>
      <section id="activity" className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">Admin Activity</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentActions.map((action) => (
                <tr key={String(action.id)}>
                  <td className="px-4 py-3 font-medium">{String(action.action ?? "—")}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {String(action.target_type ?? "user")} ·{" "}
                    {String(action.target_id ?? "—")}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {String(action.created_at ?? "—")}
                  </td>
                </tr>
              ))}
              {!recentActions.length ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                    No events.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
