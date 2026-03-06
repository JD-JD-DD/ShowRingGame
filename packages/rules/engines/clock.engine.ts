export type ClockState = {
  epochHour: number;
};

export function advanceClock(clock: ClockState, hours = 1): ClockState {
  return {
    ...clock,
    epochHour: clock.epochHour + hours,
  };
}