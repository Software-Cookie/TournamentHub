"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button, Card, Field } from "@/components/ui";
import { ImageField } from "@/components/admin/image-upload";
import { HostingFeeSummary } from "@/components/organiser/hosting-fee-summary";
import { saveTournamentAction } from "@/server/actions/manage";
import type { ActionResult } from "@/lib/validation";

export type TournamentFormValues = Partial<{
  name: string; slug: string; tagline: string; description: string; sportId: string; startDate: string; endDate: string; registrationOpensAt: string; registrationClosesAt: string;
  matchStartTime: string; reportingMinutesBefore: number; entryFee: number; maxParticipants: number | null; requiresApproval: boolean; allowMultipleCategories: boolean; isFeatured: boolean;
  rules: string; terms: string; refundPolicy: string; participantInstructions: string; reminderOffsetsHours: string; emailSenderName: string; emailReplyTo: string; bannerUrl: string;
  venueName: string; venueAddress: string; venueCity: string; venueState: string; venuePostal: string; venueMapUrl: string; venueLat: string; venueLng: string;
  organiserName: string; organiserEmail: string; organiserPhone: string; organiserLogoUrl: string;
}>;

const DEFAULT_INSTR = "Please arrive at the tournament venue at least 15 minutes before your scheduled match. Report to the registration desk for verification. Carry your ticket and a valid identification document.";

export function TournamentForm({ id, values, sports, canFeature = false, sportLocked = false }: { id: string | null; values: TournamentFormValues; sports: { id: string; name: string; isActive: boolean; listingFee?: number }[]; canFeature?: boolean; sportLocked?: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveTournamentAction.bind(null, id), null as ActionResult<{ id: string }> | null);
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message);
      if (!id && state.data) router.push(`/manage/tournaments/${state.data.id}?tab=categories`);
      else router.refresh();
    } else {
      toast.error(state.error);
      setTimeout(() => document.querySelector("[aria-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    }
  }, [state, id, router]);
  const e = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  const inv = (k: string) => (e(k) ? true : undefined);
  const v = values;
  const [sportId, setSportId] = useState(v.sportId ?? sports[0]?.id);
  const sport = sports.find((s) => s.id === sportId);

  return (
    <form action={action} className="space-y-6" noValidate>
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-extrabold">Basics</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tournament name" required htmlFor="t-name" error={e("name")} className="md:col-span-2">
            <input id="t-name" name="name" defaultValue={v.name} className="input" aria-invalid={inv("name")} />
          </Field>
          <Field label="URL slug" htmlFor="t-slug" hint="Leave empty to generate from the name">
            <input id="t-slug" name="slug" defaultValue={v.slug} className="input font-mono text-sm" />
          </Field>
          <Field label="Sport" required htmlFor="t-sport" error={e("sportId")}>
            {sportLocked && <input type="hidden" name="sportId" value={v.sportId} />}
            <select id="t-sport" name={sportLocked ? undefined : "sportId"} value={sportId} onChange={(ev) => setSportId(ev.target.value)} className="input" disabled={sportLocked}>
              {sports.map((s) => (
                <option key={s.id} value={s.id} disabled={!s.isActive}>
                  {s.name}{s.isActive ? "" : " (unavailable)"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tagline" htmlFor="t-tagline" className="md:col-span-2">
            <input id="t-tagline" name="tagline" defaultValue={v.tagline} className="input" maxLength={160} />
          </Field>
          <Field label="Description" required htmlFor="t-desc" error={e("description")} className="md:col-span-2">
            <textarea id="t-desc" name="description" defaultValue={v.description} rows={5} className="input" aria-invalid={inv("description")} />
          </Field>
          <div className="md:col-span-2">
            <ImageField name="bannerUrl" label="Tournament banner" defaultValue={v.bannerUrl} folder="banners" />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 text-lg font-extrabold">Schedule & registration</h2>
        <p className="mb-4 text-xs text-subtle">All times are Indian Standard Time (IST).</p>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Tournament starts" required htmlFor="t-start" error={e("startDate")}>
            <input id="t-start" name="startDate" type="datetime-local" defaultValue={v.startDate} className="input" aria-invalid={inv("startDate")} />
          </Field>
          <Field label="Tournament ends" htmlFor="t-end">
            <input id="t-end" name="endDate" type="datetime-local" defaultValue={v.endDate} className="input" />
          </Field>
          <Field label="First match time" htmlFor="t-mst" hint="Shown on tickets">
            <input id="t-mst" name="matchStartTime" type="time" defaultValue={v.matchStartTime} className="input" />
          </Field>
          <Field label="Registration opens" required htmlFor="t-ro" error={e("registrationOpensAt")}>
            <input id="t-ro" name="registrationOpensAt" type="datetime-local" defaultValue={v.registrationOpensAt} className="input" aria-invalid={inv("registrationOpensAt")} />
          </Field>
          <Field label="Registration closes" required htmlFor="t-rc" error={e("registrationClosesAt")}>
            <input id="t-rc" name="registrationClosesAt" type="datetime-local" defaultValue={v.registrationClosesAt} className="input" aria-invalid={inv("registrationClosesAt")} />
          </Field>
          <Field label="Report minutes before match" htmlFor="t-rep">
            <input id="t-rep" name="reportingMinutesBefore" type="number" min={0} max={180} defaultValue={v.reportingMinutesBefore ?? 15} className="input" />
          </Field>
          <Field label="Default entry fee (₹)" required htmlFor="t-fee" error={e("entryFee")} hint="Categories can override this">
            <input id="t-fee" name="entryFee" type="number" min={0} step="1" defaultValue={v.entryFee ?? 0} className="input" aria-invalid={inv("entryFee")} />
          </Field>
          <Field label="Max participants (all categories)" htmlFor="t-max" hint="Leave empty for no overall cap">
            <input id="t-max" name="maxParticipants" type="number" min={1} defaultValue={v.maxParticipants ?? ""} className="input" />
          </Field>
          <Field label="Reminder emails (hours before start)" htmlFor="t-rem" hint="Comma-separated, e.g. 24,3">
            <input id="t-rem" name="reminderOffsetsHours" defaultValue={v.reminderOffsetsHours ?? "24,3"} className="input" />
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <Toggle name="requiresApproval" label="Manual approval of entries" defaultChecked={v.requiresApproval} />
          <Toggle name="allowMultipleCategories" label="Players may enter multiple categories" defaultChecked={v.allowMultipleCategories ?? true} />
          {canFeature && <Toggle name="isFeatured" label="Feature on landing page" defaultChecked={v.isFeatured} />}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-extrabold">Venue</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Venue name" required htmlFor="v-name" error={e("venueName")} className="sm:col-span-2">
              <input id="v-name" name="venueName" defaultValue={v.venueName} className="input" aria-invalid={inv("venueName")} />
            </Field>
            <Field label="Address" required htmlFor="v-addr" error={e("venueAddress")} className="sm:col-span-2">
              <input id="v-addr" name="venueAddress" defaultValue={v.venueAddress} className="input" aria-invalid={inv("venueAddress")} />
            </Field>
            <Field label="City" required htmlFor="v-city" error={e("venueCity")}>
              <input id="v-city" name="venueCity" defaultValue={v.venueCity} className="input" aria-invalid={inv("venueCity")} />
            </Field>
            <Field label="State" htmlFor="v-state">
              <input id="v-state" name="venueState" defaultValue={v.venueState} className="input" />
            </Field>
            <Field label="PIN code" htmlFor="v-pin">
              <input id="v-pin" name="venuePostal" defaultValue={v.venuePostal} className="input" />
            </Field>
            <Field label="Google Maps link" htmlFor="v-map" error={e("venueMapUrl")}>
              <input id="v-map" name="venueMapUrl" defaultValue={v.venueMapUrl} className="input" placeholder="https://maps.app.goo.gl/…" />
            </Field>
            <Field label="Latitude" htmlFor="v-lat">
              <input id="v-lat" name="venueLat" defaultValue={v.venueLat} className="input" inputMode="decimal" />
            </Field>
            <Field label="Longitude" htmlFor="v-lng">
              <input id="v-lng" name="venueLng" defaultValue={v.venueLng} className="input" inputMode="decimal" />
            </Field>
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-extrabold">Organiser & email</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Organiser name" required htmlFor="o-name" error={e("organiserName")} className="sm:col-span-2">
              <input id="o-name" name="organiserName" defaultValue={v.organiserName} className="input" aria-invalid={inv("organiserName")} />
            </Field>
            <Field label="Contact email" required htmlFor="o-email" error={e("organiserEmail")}>
              <input id="o-email" name="organiserEmail" type="email" defaultValue={v.organiserEmail} className="input" aria-invalid={inv("organiserEmail")} />
            </Field>
            <Field label="Contact phone" required htmlFor="o-phone" error={e("organiserPhone")}>
              <input id="o-phone" name="organiserPhone" defaultValue={v.organiserPhone} className="input" aria-invalid={inv("organiserPhone")} />
            </Field>
            <Field label="Email sender name" htmlFor="o-sender" hint="Shown as the From name">
              <input id="o-sender" name="emailSenderName" defaultValue={v.emailSenderName} className="input" />
            </Field>
            <Field label="Reply-to email" htmlFor="o-reply" error={e("emailReplyTo")}>
              <input id="o-reply" name="emailReplyTo" type="email" defaultValue={v.emailReplyTo} className="input" />
            </Field>
            <div className="sm:col-span-2">
              <ImageField name="organiserLogoUrl" label="Organiser logo" defaultValue={v.organiserLogoUrl} aspect="aspect-[3/1]" folder="logos" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-extrabold">Rules, policies & instructions</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Rules & regulations" htmlFor="t-rules">
            <textarea id="t-rules" name="rules" defaultValue={v.rules} rows={6} className="input" />
          </Field>
          <Field label="Terms & conditions" htmlFor="t-terms">
            <textarea id="t-terms" name="terms" defaultValue={v.terms} rows={6} className="input" />
          </Field>
          <Field label="Cancellation & refund policy" htmlFor="t-refund">
            <textarea id="t-refund" name="refundPolicy" defaultValue={v.refundPolicy} rows={5} className="input" />
          </Field>
          <Field label="Participant instructions (printed on tickets & reminders)" htmlFor="t-instr">
            <textarea id="t-instr" name="participantInstructions" defaultValue={v.participantInstructions ?? DEFAULT_INSTR} rows={5} className="input" />
          </Field>
        </div>
      </Card>

      {!id && sport?.listingFee != null && (
        <Card className="p-6">
          <h2 className="text-lg font-extrabold">Hosting fee</h2>
          <p className="mb-4 mt-1 text-sm text-muted">Pay this once, after you create the tournament, to publish it. You can set everything up first.</p>
          <HostingFeeSummary sportName={sport.name} listingFee={sport.listingFee} />
        </Card>
      )}

      <div className="sticky bottom-20 z-10 flex justify-end lg:bottom-4">
        <Button type="submit" size="lg" variant="accent" loading={pending} className="shadow-lift">
          <Save className="size-4" /> {id ? "Save changes" : "Create tournament"}
        </Button>
      </div>
    </form>
  );
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 font-medium">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative h-6 w-11 rounded-full bg-line transition after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-brand peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-brand" />
      {label}
    </label>
  );
}
