import React from "react";

import { Button, Spinner, Typography, cn } from "~/components/ui";

export const authFooterClassName = "mt-6 border-t border-black/[0.06] pt-5 text-center text-sm dark:border-white/[0.10]";
export const authFooterLinkClassName = "font-medium text-foreground/90 underline-offset-4 transition-colors hover:text-foreground hover:underline";

const HEXCLAVE_SOURCE_CODE_URL = "https://github.com/Gelhaus-Solutions/hexclave";

// AGPL-3.0 section 13: users interacting with this service over a network are offered the source.
export function HostedSourceCodeLink() {
  return (
    <p className="relative z-10 mt-4 text-center text-xs text-muted-foreground">
      <a
        href={HEXCLAVE_SOURCE_CODE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={authFooterLinkClassName}
      >
        Source code
      </a>
    </p>
  );
}

export function HostedAuthShell(props: {
  children: React.ReactNode,
  fullPage?: boolean,
  paddedFullPage?: boolean,
}) {
  const content = (
    <div
      className={cn(
        "stack-scope relative z-10 flex w-full max-w-[400px] flex-col items-stretch text-foreground",
        props.fullPage && props.paddedFullPage !== false ? "p-4 sm:p-6" : "p-0",
      )}
    >
      {props.children}
    </div>
  );

  if (!props.fullPage) {
    return content;
  }

  return (
    <div
      data-hexclave-handler-page
      className="stack-scope relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background p-4 sm:p-6"
    >
      {content}
      <HostedSourceCodeLink />
    </div>
  );
}

export function HostedAuthHeading(props: {
  title: string,
  children?: React.ReactNode,
}) {
  return (
    <div className="mb-6 text-center">
      <Typography type="h2" className="mb-1 text-xl font-semibold tracking-tight">{props.title}</Typography>
      {props.children != null && (
        <Typography className="text-sm text-muted-foreground">{props.children}</Typography>
      )}
    </div>
  );
}

type HostedAuthMessageAction = () => Promise<void> | void;
type HostedAuthMessageSecondaryActionProps =
  | {
    secondaryAction: HostedAuthMessageAction,
    secondaryText: string,
  }
  | {
    secondaryAction?: never,
    secondaryText?: never,
  };
type HostedAuthMessageActionProps =
  | ({
    primaryAction: HostedAuthMessageAction,
    primaryText: string,
  } & HostedAuthMessageSecondaryActionProps)
  | {
    primaryAction?: never,
    primaryText?: never,
    secondaryAction?: never,
    secondaryText?: never,
  };

export function HostedAuthMessage(props: {
  title: string,
  children: React.ReactNode,
  fullPage?: boolean,
} & HostedAuthMessageActionProps) {
  const hasPrimaryAction = props.primaryAction != null;
  const hasSecondaryAction = props.secondaryAction != null;

  return (
    <HostedAuthShell fullPage={props.fullPage}>
      <div className="text-center">
        <Typography type="h2" className="mb-2 text-xl font-semibold tracking-tight">{props.title}</Typography>
        <Typography className="text-sm text-muted-foreground">{props.children}</Typography>
      </div>
      {(hasPrimaryAction || hasSecondaryAction) && (
        <div className="mt-6 flex flex-col gap-2.5">
          {hasPrimaryAction && (
            <Button onClick={props.primaryAction} className="h-10 rounded-xl font-semibold shadow-sm hover:shadow">
              {props.primaryText}
            </Button>
          )}
          {hasSecondaryAction && (
            <Button variant="secondary" onClick={props.secondaryAction} className="h-10 rounded-xl font-semibold">
              {props.secondaryText}
            </Button>
          )}
        </div>
      )}
    </HostedAuthShell>
  );
}

export function HostedAuthLoading(props: {
  fullPage?: boolean,
}) {
  return (
    <HostedAuthShell fullPage={props.fullPage}>
      <div className="flex min-h-24 items-center justify-center">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    </HostedAuthShell>
  );
}

export function HostedAuthFallback(props: {
  fullPage?: boolean,
}) {
  const content = (
    <div className="stack-scope flex w-full max-w-[400px] flex-col items-stretch p-4 sm:p-6">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="hosted-skeleton h-6 w-40 rounded-lg" />
        <div className="hosted-skeleton mt-2 h-3 w-56 rounded-full" />
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="hosted-skeleton h-3 w-16 rounded-full" />
          <div className="hosted-skeleton h-10 w-full rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <div className="hosted-skeleton h-3 w-24 rounded-full" />
          <div className="hosted-skeleton h-10 w-full rounded-xl" />
        </div>
        <div className="hosted-skeleton h-10 w-full rounded-xl" />
      </div>
    </div>
  );

  if (!props.fullPage) {
    return content;
  }

  return (
    <div
      data-hexclave-handler-page
      className="stack-scope flex min-h-screen w-full items-center justify-center bg-background p-4 sm:p-6"
    >
      {content}
    </div>
  );
}
