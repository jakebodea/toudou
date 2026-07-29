import {
  AnimatePresence,
  LayoutGroup,
  motion,
  type Transition,
} from "motion/react";
import type { ReactNode } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion.tsx";
import { Kbd, KbdGroup } from "@/components/ui/kbd.tsx";
import type { Capture } from "@/lib/types.ts";

interface CaptureInboxListProps {
  active: Capture[];
  done: Capture[];
  doneOpen: boolean;
  inProgress: Capture[];
  inProgressEnabled: boolean;
  isVacant: boolean;
  layoutEnabled: boolean;
  listExitTransition: Transition;
  listLayoutTransition: Transition;
  noMatches: boolean;
  onDoneOpenChange: (open: boolean) => void;
  query: string;
  reduceMotion: boolean | null;
  renderCard: (capture: Capture) => ReactNode;
  sharedLayout: boolean;
}

interface ListMotionProps {
  layoutEnabled: boolean;
  listExitTransition: Transition;
  listLayoutTransition: Transition;
  reduceMotion: boolean | null;
  renderCard: (capture: Capture) => ReactNode;
  sharedLayout: boolean;
}

export function CaptureInboxList({
  active,
  done,
  doneOpen,
  inProgress,
  inProgressEnabled,
  isVacant,
  layoutEnabled,
  listExitTransition,
  listLayoutTransition,
  noMatches,
  onDoneOpenChange,
  query,
  reduceMotion,
  renderCard,
  sharedLayout,
}: CaptureInboxListProps) {
  const motionProps: ListMotionProps = {
    layoutEnabled,
    listExitTransition,
    listLayoutTransition,
    reduceMotion,
    renderCard,
    sharedLayout,
  };

  return (
    <LayoutGroup id="towdow-captures">
      <div className="flex flex-col gap-2.5 px-4 py-3 pb-6">
        {isVacant ? <EmptyInbox /> : null}

        {noMatches ? (
          <p className="px-2 py-8 text-muted-foreground text-sm">
            Nothing matches “{query}”.
          </p>
        ) : null}

        <ActiveCaptureList active={active} {...motionProps} />

        {inProgressEnabled && inProgress.length > 0 ? (
          <InProgressSection inProgress={inProgress} {...motionProps} />
        ) : null}

        {done.length > 0 || doneOpen ? (
          <DoneSection
            done={done}
            doneOpen={doneOpen}
            onDoneOpenChange={onDoneOpenChange}
            {...motionProps}
          />
        ) : null}
      </div>
    </LayoutGroup>
  );
}

function EmptyInbox() {
  return (
    <div className="flex flex-col items-start gap-2 px-2 py-14 text-muted-foreground">
      <p className="font-medium text-foreground text-sm">
        Your capture inbox is empty
      </p>
      <p className="max-w-[16rem] text-sm leading-relaxed">
        Drop something in below, or grab text from any app with{" "}
        <KbdGroup className="mx-0.5 inline-flex">
          <Kbd>⇧</Kbd>
          <Kbd>⇧</Kbd>
        </KbdGroup>
        .
      </p>
    </div>
  );
}

function ActiveCaptureList({
  active,
  layoutEnabled,
  listExitTransition,
  listLayoutTransition,
  reduceMotion,
  renderCard,
  sharedLayout,
}: ListMotionProps & { active: Capture[] }) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {active.map((capture) => (
        <motion.div
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={
            sharedLayout || reduceMotion
              ? undefined
              : {
                  opacity: 0,
                  scale: 0.97,
                  transition: listExitTransition,
                  y: -6,
                }
          }
          initial={
            sharedLayout || reduceMotion
              ? false
              : { opacity: 0, scale: 0.98, y: 6 }
          }
          key={capture.id}
          layout={layoutEnabled ? "position" : false}
          layoutId={sharedLayout ? capture.id : undefined}
          transition={listLayoutTransition}
        >
          {renderCard(capture)}
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

function InProgressSection({
  inProgress,
  layoutEnabled,
  listExitTransition,
  listLayoutTransition,
  reduceMotion,
  renderCard,
  sharedLayout,
}: ListMotionProps & { inProgress: Capture[] }) {
  return (
    <AnimatePresence initial={false}>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        exit={
          reduceMotion
            ? undefined
            : {
                opacity: 0,
                transition: listExitTransition,
                y: -4,
              }
        }
        initial={reduceMotion ? false : { opacity: 0, y: -6 }}
        key="in-progress-section"
        layout={layoutEnabled ? "position" : false}
        transition={listLayoutTransition}
      >
        <div className="mt-2 flex flex-col gap-2.5">
          <div className="px-1 py-2 text-[11px] text-muted-foreground tracking-[0.1em]">
            IN PROGRESS
            <span className="ml-1.5 font-normal tracking-normal opacity-70">
              {inProgress.length}
            </span>
          </div>
          {inProgress.map((capture) => (
            <motion.div
              key={capture.id}
              layout={sharedLayout ? "position" : false}
              layoutId={sharedLayout ? capture.id : undefined}
              transition={listLayoutTransition}
            >
              {renderCard(capture)}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function DoneSection({
  done,
  doneOpen,
  layoutEnabled,
  listExitTransition,
  listLayoutTransition,
  onDoneOpenChange,
  reduceMotion,
  renderCard,
  sharedLayout,
}: ListMotionProps & {
  done: Capture[];
  doneOpen: boolean;
  onDoneOpenChange: (open: boolean) => void;
}) {
  return (
    <AnimatePresence initial={false}>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        exit={
          reduceMotion
            ? undefined
            : {
                opacity: 0,
                transition: listExitTransition,
                y: -4,
              }
        }
        initial={reduceMotion ? false : { opacity: 0, y: -6 }}
        key="done-section"
        layout={layoutEnabled ? "position" : false}
        transition={listLayoutTransition}
      >
        <Accordion
          collapsible
          onValueChange={(value) => {
            onDoneOpenChange(value === "done");
          }}
          type="single"
          value={doneOpen ? "done" : ""}
        >
          <AccordionItem className="mt-2 border-0" value="done">
            <AccordionTrigger className="px-1 py-2 text-[11px] text-muted-foreground tracking-[0.1em] hover:no-underline">
              DONE
              {done.length > 0 ? (
                <span className="ml-1.5 font-normal tracking-normal opacity-70">
                  {done.length}
                </span>
              ) : null}
            </AccordionTrigger>
            <AccordionContent className="flex flex-col gap-2.5 px-0.5 pt-1.5">
              {done.length === 0 ? (
                <p className="px-1 text-muted-foreground text-sm">
                  Nothing completed yet.
                </p>
              ) : (
                done.map((capture) => (
                  <motion.div
                    key={capture.id}
                    layout={sharedLayout ? "position" : false}
                    layoutId={sharedLayout ? capture.id : undefined}
                    transition={listLayoutTransition}
                  >
                    {renderCard(capture)}
                  </motion.div>
                ))
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </motion.div>
    </AnimatePresence>
  );
}
