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
import {
  clearAllStaggerDelay,
  LIST_CLEAR_EXIT_TRANSITION,
  LIST_ENTER_TRANSITION,
  LIST_EXIT_TRANSITION,
} from "@/lib/list-motion.ts";
import type { Capture } from "@/lib/types.ts";

interface CaptureInboxListProps {
  active: Capture[];
  clearingAll: boolean;
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
  clearingAll: boolean;
  layoutEnabled: boolean;
  listExitTransition: Transition;
  listLayoutTransition: Transition;
  reduceMotion: boolean | null;
  renderCard: (capture: Capture) => ReactNode;
  sharedLayout: boolean;
}

export function CaptureInboxList({
  active,
  clearingAll,
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
    clearingAll,
    layoutEnabled,
    listExitTransition,
    listLayoutTransition,
    reduceMotion,
    renderCard,
    sharedLayout,
  };

  const inProgressBase = active.length;
  const doneBase = active.length + inProgress.length;

  return (
    <LayoutGroup id="toudou-captures">
      <div
        className={
          clearingAll
            ? "pointer-events-none flex flex-col gap-2.5 px-4 py-3 pb-6"
            : "flex flex-col gap-2.5 px-4 py-3 pb-6"
        }
      >
        <AnimatePresence initial={false}>
          {isVacant ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              key="empty-inbox"
              transition={LIST_EXIT_TRANSITION}
            >
              <EmptyInbox />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {noMatches ? (
          <p className="px-2 py-8 text-muted-foreground text-sm">
            Nothing matches “{query}”.
          </p>
        ) : null}

        <ActiveCaptureList active={active} staggerBase={0} {...motionProps} />

        {inProgressEnabled && inProgress.length > 0 ? (
          <InProgressSection
            inProgress={inProgress}
            staggerBase={inProgressBase}
            {...motionProps}
          />
        ) : null}

        {done.length > 0 || doneOpen ? (
          <DoneSection
            done={done}
            doneOpen={doneOpen}
            onDoneOpenChange={onDoneOpenChange}
            staggerBase={doneBase}
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

function clearCardAnimate(exitingClear: boolean) {
  return exitingClear
    ? { opacity: 0, scale: 0.97, y: -10 }
    : { opacity: 1, scale: 1, y: 0 };
}

function clearCardTransition(
  exitingClear: boolean,
  clearIndex: number,
  listLayoutTransition: Transition
) {
  if (!exitingClear) {
    return {
      ...LIST_ENTER_TRANSITION,
      layout: listLayoutTransition,
    };
  }
  return {
    ...LIST_CLEAR_EXIT_TRANSITION,
    delay: clearAllStaggerDelay(clearIndex),
  };
}

function ActiveCaptureList({
  active,
  clearingAll,
  layoutEnabled,
  listExitTransition,
  listLayoutTransition,
  reduceMotion,
  renderCard,
  sharedLayout,
  staggerBase,
}: ListMotionProps & { active: Capture[]; staggerBase: number }) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {active.map((capture, index) => {
        const clearIndex = staggerBase + index;
        const exitingClear = clearingAll && !reduceMotion;
        return (
          <motion.div
            animate={clearCardAnimate(exitingClear)}
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
                : { opacity: 0, scale: 0.98, y: 10 }
            }
            key={capture.id}
            layout={layoutEnabled && !clearingAll ? "position" : false}
            layoutId={sharedLayout && !clearingAll ? capture.id : undefined}
            transition={clearCardTransition(
              exitingClear,
              clearIndex,
              listLayoutTransition
            )}
          >
            {renderCard(capture)}
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
}

function InProgressSection({
  clearingAll,
  inProgress,
  layoutEnabled,
  listExitTransition,
  listLayoutTransition,
  reduceMotion,
  renderCard,
  sharedLayout,
  staggerBase,
}: ListMotionProps & { inProgress: Capture[]; staggerBase: number }) {
  const exitingClear = clearingAll && !reduceMotion;

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
        layout={layoutEnabled && !clearingAll ? "position" : false}
        transition={listLayoutTransition}
      >
        <div className="mt-2 flex flex-col gap-2.5">
          <motion.div
            animate={
              exitingClear ? { opacity: 0, y: -4 } : { opacity: 1, y: 0 }
            }
            className="px-1 py-2 text-[11px] text-muted-foreground tracking-[0.1em]"
            transition={clearCardTransition(
              exitingClear,
              staggerBase,
              listLayoutTransition
            )}
          >
            IN PROGRESS
            <span className="ml-1.5 font-normal tracking-normal opacity-70">
              {inProgress.length}
            </span>
          </motion.div>
          {inProgress.map((capture, index) => {
            const clearIndex = staggerBase + index;
            return (
              <motion.div
                animate={clearCardAnimate(exitingClear)}
                key={capture.id}
                layout={sharedLayout && !clearingAll ? "position" : false}
                layoutId={sharedLayout && !clearingAll ? capture.id : undefined}
                transition={clearCardTransition(
                  exitingClear,
                  clearIndex,
                  listLayoutTransition
                )}
              >
                {renderCard(capture)}
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function DoneSection({
  clearingAll,
  done,
  doneOpen,
  layoutEnabled,
  listExitTransition,
  listLayoutTransition,
  onDoneOpenChange,
  reduceMotion,
  renderCard,
  sharedLayout,
  staggerBase,
}: ListMotionProps & {
  done: Capture[];
  doneOpen: boolean;
  onDoneOpenChange: (open: boolean) => void;
  staggerBase: number;
}) {
  const exitingClear = clearingAll && !reduceMotion;
  const headerIndex = doneOpen ? staggerBase : Math.max(staggerBase - 1, 0);

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
        layout={layoutEnabled && !clearingAll ? "position" : false}
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
            <motion.div
              animate={
                exitingClear ? { opacity: 0, y: -4 } : { opacity: 1, y: 0 }
              }
              transition={clearCardTransition(
                exitingClear,
                headerIndex,
                listLayoutTransition
              )}
            >
              <AccordionTrigger className="px-1 py-2 text-[11px] text-muted-foreground tracking-[0.1em] hover:no-underline">
                DONE
                {done.length > 0 ? (
                  <span className="ml-1.5 font-normal tracking-normal opacity-70">
                    {done.length}
                  </span>
                ) : null}
              </AccordionTrigger>
            </motion.div>
            <AccordionContent className="flex flex-col gap-2.5 px-0.5 pt-1.5">
              {done.length === 0 ? (
                <p className="px-1 text-muted-foreground text-sm">
                  Nothing completed yet.
                </p>
              ) : (
                done.map((capture, index) => {
                  const clearIndex = staggerBase + index;
                  const cardExiting = exitingClear && doneOpen;
                  return (
                    <motion.div
                      animate={clearCardAnimate(cardExiting)}
                      key={capture.id}
                      layout={sharedLayout && !clearingAll ? "position" : false}
                      layoutId={
                        sharedLayout && !clearingAll ? capture.id : undefined
                      }
                      transition={clearCardTransition(
                        cardExiting,
                        clearIndex,
                        listLayoutTransition
                      )}
                    >
                      {renderCard(capture)}
                    </motion.div>
                  );
                })
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </motion.div>
    </AnimatePresence>
  );
}
