'use client';

// StepIndicator — 3-step progress bar shown on Generate and Review pages

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
}

const STEPS = [
  { num: 1, label: 'Contract Type' },
  { num: 2, label: 'Fill Details' },
  { num: 3, label: 'Review & Send' },
];

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-3 text-sm font-medium mb-10">
      {STEPS.map((step, i) => {
        const isActive = step.num <= currentStep;
        const isCurrent = step.num === currentStep;
        return (
          <div key={step.num} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isActive
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-200 text-slate-500'
                } ${isCurrent ? 'ring-2 ring-teal-300 ring-offset-1' : ''}`}
              >
                {step.num}
              </span>
              <span className={isActive ? 'text-teal-800' : 'text-slate-400'}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className={isActive ? 'text-teal-400' : 'text-slate-300'}>→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
