import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { useToast } from "./ui/toast";
import FpJS from "@fingerprintjs/fingerprintjs";

interface OptionInput {
  id: string;
  text: string;
}

export function PollCreator() {
  const { addToast } = useToast();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<OptionInput[]>([
    { id: "1", text: "" },
    { id: "2", text: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    question?: string;
    options?: string;
  }>({});
  const [focusedOption, setFocusedOption] = useState<string | null>(null);

  // Initialize fingerprint to get creator ID
  useEffect(() => {
    const initFingerprint = async () => {
      try {
        const fp = await FpJS.load();
        const result = await fp.get();
        setCreatorId(result.visitorId);
      } catch (error) {
        console.error("Error initializing fingerprint:", error);
      }
    };
    initFingerprint();
  }, []);

  const validateForm = () => {
    const newErrors: { question?: string; options?: string } = {};

    if (!question.trim()) {
      newErrors.question = "Please enter a question";
    } else if (question.trim().length < 3) {
      newErrors.question = "Question must be at least 3 characters";
    }

    const validOptions = options.filter((opt) => opt.text.trim().length > 0);
    if (validOptions.length < 2) {
      newErrors.options = "Please provide at least 2 options with text";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const addOption = () => {
    if (options.length < 10) {
      const newOption = { id: Date.now().toString(), text: "" };
      setOptions([...options, newOption]);
      setTimeout(() => setFocusedOption(newOption.id), 50);
    } else {
      addToast("Maximum 10 options allowed", "error");
    }
  };

  const removeOption = (id: string) => {
    if (options.length > 2) {
      setOptions(options.filter((opt) => opt.id !== id));
    } else {
      addToast("At least 2 options are required", "error");
    }
  };

  const updateOption = (id: string, text: string) => {
    setOptions(options.map((opt) => (opt.id === id ? { ...opt, text } : opt)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      addToast("Please fix the errors before submitting", "error");
      return;
    }

    const validOptions = options.filter((opt) => opt.text.trim().length > 0);

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          options: validOptions.map((opt) => opt.text.trim()),
          creatorId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setShareUrl(data.shareUrl);
        addToast("Poll created successfully!", "success");
      } else {
        addToast(data.error || "Failed to create poll", "error");
      }
    } catch (error) {
      console.error("Error creating poll:", error);
      addToast("Failed to create poll", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    addToast("Link copied to clipboard!", "success");
  };

  const resetForm = () => {
    setQuestion("");
    setOptions([
      { id: "1", text: "" },
      { id: "2", text: "" },
    ]);
    setShareUrl("");
    setErrors({});
  };

  if (shareUrl) {
    return (
      <Card className="w-full max-w-2xl mx-auto border-2 shadow-2xl bg-card/50 backdrop-blur overflow-hidden animate-scale-in">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
        <CardHeader className="text-center space-y-3 relative">
          <div className="relative inline-block">
            <div className="text-7xl mb-2 animate-bounce">🎉</div>
            <div className="absolute inset-0 blur-2xl bg-primary/20 rounded-full scale-75" />
          </div>
          <CardTitle className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Poll Created!
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Your poll is ready to share with the world
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 relative">
          <div className="space-y-3">
            <Label className="text-lg font-semibold flex items-center gap-2">
              <svg
                className="h-5 w-5 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              Share this link
            </Label>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Input
                  value={shareUrl}
                  readOnly
                  className="text-base font-mono bg-muted/50 pr-24 border-2"
                />
                <Button
                  onClick={copyShareUrl}
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  Copy
                </Button>
              </div>
            </div>
          </div>
          <div className="pt-4 grid grid-cols-2 gap-3">
            <Button
              onClick={resetForm}
              variant="outline"
              className="h-12 text-base border-2 hover:bg-accent/10 transition-all"
            >
              <svg
                className="h-4 w-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create Another
            </Button>
            <Button
              onClick={() => (window.location.href = shareUrl)}
              className="h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              <svg
                className="h-4 w-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              View Poll
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getValidOptionCount = () =>
    options.filter((opt) => opt.text.trim().length > 0).length;

  return (
    <Card className="w-full max-w-2xl mx-auto border-2 shadow-2xl bg-card/50 backdrop-blur overflow-hidden animate-scale-in">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
      <CardHeader className="text-center space-y-2 relative">
        <CardTitle className="text-4xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
          Create a Poll
        </CardTitle>
        <CardDescription className="text-base text-muted-foreground">
          Ask a question and get instant feedback from anyone, anywhere
        </CardDescription>
      </CardHeader>
      <CardContent className="relative">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-3">
            <Label
              htmlFor="question"
              className="text-lg font-semibold flex items-center gap-2"
            >
              <span className="flex items-center justify-center w-6 h-6 rounded bg-primary text-primary-foreground text-sm font-bold">
                Q
              </span>
              Your Question
            </Label>
            <div className="relative">
              <Input
                id="question"
                placeholder="What would you like to ask?"
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  if (errors.question)
                    setErrors({ ...errors, question: undefined });
                }}
                maxLength={500}
                className={`text-lg bg-muted/30 border-2 transition-all duration-200 ${
                  errors.question
                    ? "border-destructive focus:border-destructive"
                    : "focus:border-primary"
                } ${question ? "bg-card/80" : ""}`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-background/80 px-2 rounded">
                {question.length}/500
              </div>
            </div>
            {errors.question && (
              <p className="text-sm text-destructive font-medium flex items-center gap-2 animate-slide-up">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {errors.question}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded bg-secondary text-secondary-foreground text-sm font-bold">
                  A
                </span>
                Answer Options
              </Label>
              <span className="text-sm text-muted-foreground">
                {getValidOptionCount()} of 2+ required
              </span>
            </div>
            {errors.options && (
              <p className="text-sm text-destructive font-medium flex items-center gap-2">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {errors.options}
              </p>
            )}
            <div className="space-y-3">
              {options.map((option, index) => (
                <div
                  key={option.id}
                  className="group flex gap-3 items-center animate-slide-up"
                  style={{
                    animationDelay: `${index * 50}ms`,
                    animationFillMode: "both",
                  }}
                >
                  <div className="flex items-center justify-center w-10 h-12 rounded-lg bg-primary/10 text-primary font-bold text-base shrink-0 border-2 border-primary/20">
                    {index + 1}
                  </div>
                  <div className="flex-1 relative">
                    <Input
                      placeholder={`Option ${index + 1}`}
                      value={option.text}
                      onChange={(e) => {
                        updateOption(option.id, e.target.value);
                        if (errors.options)
                          setErrors({ ...errors, options: undefined });
                      }}
                      maxLength={200}
                      onFocus={() => setFocusedOption(option.id)}
                      onBlur={() => setFocusedOption(null)}
                      className={`text-base bg-muted/30 border-2 transition-all duration-200 ${
                        errors.options && !option.text.trim()
                          ? "border-destructive"
                          : focusedOption === option.id
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-border"
                      } ${option.text ? "bg-card/80" : ""}`}
                    />
                  </div>
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(option.id)}
                      className="shrink-0 hover:bg-destructive/20 hover:text-destructive transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                      disabled={isSubmitting}
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={addOption}
              className="w-full h-12 text-base border-2 border-dashed hover:border-solid hover:bg-accent/10 hover:border-accent transition-all group"
              disabled={options.length >= 10 || isSubmitting}
            >
              <svg
                className="h-5 w-5 mr-2 transition-transform group-hover:rotate-90"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Another Option
              <span className="ml-auto text-xs text-muted-foreground">
                {options.length}/10
              </span>
            </Button>
          </div>

          <Button
            type="submit"
            className="w-full h-14 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all relative overflow-hidden group"
            disabled={
              isSubmitting || !question.trim() || getValidOptionCount() < 2
            }
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-secondary to-accent opacity-0 group-hover:opacity-20 transition-opacity" />
            <div className="relative flex items-center justify-center">
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creating Poll...
                </>
              ) : (
                <>
                  <svg
                    className="h-5 w-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Create Poll
                </>
              )}
            </div>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
