import { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Progress } from "./ui/progress";
import { Skeleton } from "./ui/skeleton";
import { useToast } from "./ui/toast";
import { AnimatedNumber } from "./AnimatedNumber";
import FpJS from "@fingerprintjs/fingerprintjs";

interface Option {
  id: string;
  text: string;
  voteCount: number;
}

interface PollData {
  id: string;
  question: string;
  creatorId: string;
  options: Option[];
  totalVotes: number;
}

interface PollViewerProps {
  pollId: string;
}

// Cache keys - poll data for 5 minutes, vote status persists
const POLL_CACHE_KEY = (pollId: string) => `poll_data_${pollId}`;
const VOTE_CACHE_KEY = (pollId: string, visitorId: string) =>
  `vote_status_${pollId}_${visitorId}`;
const POLL_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function PollViewer({ pollId }: PollViewerProps) {
  const { addToast } = useToast();
  const [poll, setPoll] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [justVotedId, setJustVotedId] = useState<string | null>(null);
  const [checkingVote, setCheckingVote] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Initialize fingerprint and check vote status
  useEffect(() => {
    const initFingerprint = async () => {
      try {
        const fp = await FpJS.load();
        const result = await fp.get();
        const vid = result.visitorId;
        setVisitorId(vid);

        // Check localStorage cache first
        const voteCacheKey = VOTE_CACHE_KEY(pollId, vid);
        const cachedVote = localStorage.getItem(voteCacheKey);

        if (cachedVote) {
          const { hasVoted: cachedHasVoted, optionId } = JSON.parse(cachedVote);
          if (cachedHasVoted) {
            setHasVoted(true);
            setJustVotedId(optionId);
          }
        }

        // Verify with API in background
        try {
          const response = await fetch(
            `/api/polls/${pollId}/check-vote?visitorId=${vid}`,
          );
          if (response.ok) {
            const data = await response.json();
            if (data.hasVoted) {
              setHasVoted(true);
              setJustVotedId(data.optionId);
              // Update cache
              localStorage.setItem(
                voteCacheKey,
                JSON.stringify({ hasVoted: true, optionId: data.optionId }),
              );
            } else {
              // Clear cache if not voted
              localStorage.removeItem(voteCacheKey);
            }
          }
        } catch (error) {
          console.error("Error checking vote status:", error);
        }

        setCheckingVote(false);
      } catch (error) {
        console.error("Error initializing fingerprint:", error);
        setCheckingVote(false);
      }
    };
    initFingerprint();
  }, [pollId]);

  // Fetch poll data with caching
  const fetchPoll = useCallback(
    async (bypassCache = false) => {
      try {
        const pollCacheKey = POLL_CACHE_KEY(pollId);

        // Only use cache if we're not bypassing it
        if (!bypassCache) {
          const cachedPoll = localStorage.getItem(pollCacheKey);
          if (cachedPoll) {
            const { data, timestamp } = JSON.parse(cachedPoll);
            const age = Date.now() - timestamp;
            if (age < POLL_CACHE_DURATION) {
              setPoll(data);
              setLoading(false);
              return;
            }
          }
        }

        const response = await fetch(`/api/polls/${pollId}`);
        const data = await response.json();

        if (response.ok) {
          setPoll(data);
          // Cache the data
          localStorage.setItem(
            pollCacheKey,
            JSON.stringify({ data, timestamp: Date.now() }),
          );
        } else if (response.status === 404) {
          addToast("Poll not found", "error");
        } else {
          addToast(data.error || "Failed to load poll", "error");
        }
      } catch (error) {
        console.error("Error fetching poll:", error);
        addToast("Failed to load poll", "error");
      } finally {
        setLoading(false);
      }
    },
    [pollId, addToast],
  );

  // Initial fetch
  useEffect(() => {
    if (!checkingVote) {
      fetchPoll();
    }
  }, [fetchPoll, checkingVote]);

  // Set up SSE for real-time updates (connect immediately, not just after voting)
  useEffect(() => {
    if (!poll) return;

    const eventSource = new EventSource(`/api/polls/${pollId}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "update" && data.voteCounts) {
          setPoll((prevPoll) => {
            if (!prevPoll) return null;

            const updatedOptions = prevPoll.options.map((opt) => {
              const voteCount = data.voteCounts.find(
                (v: { optionId: string; count: number }) =>
                  v.optionId === opt.id,
              );
              return {
                ...opt,
                voteCount: voteCount?.count || 0,
              };
            });

            return {
              ...prevPoll,
              options: updatedOptions,
              totalVotes: data.totalVotes,
            };
          });
        }
      } catch (error) {
        console.error("Error parsing SSE data:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE error:", error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [pollId, poll]);

  const handleVote = async () => {
    if (!selectedOption || !visitorId || voting) return;

    setVoting(true);
    setJustVotedId(selectedOption);

    // Optimistically update UI to show the vote immediately
    setPoll((prevPoll) => {
      if (!prevPoll) return null;

      return {
        ...prevPoll,
        options: prevPoll.options.map((opt) =>
          opt.id === selectedOption
            ? { ...opt, voteCount: opt.voteCount + 1 }
            : opt,
        ),
        totalVotes: prevPoll.totalVotes + 1,
      };
    });

    try {
      const response = await fetch(`/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionId: selectedOption,
          visitorId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setHasVoted(true);

        // Store vote status in cache
        const voteCacheKey = VOTE_CACHE_KEY(pollId, visitorId);
        localStorage.setItem(
          voteCacheKey,
          JSON.stringify({ hasVoted: true, optionId: selectedOption }),
        );

        // Clear poll cache to force refresh
        localStorage.removeItem(POLL_CACHE_KEY(pollId));

        addToast("Vote recorded successfully!", "success");

        // Fetch actual data from server to verify (in background)
        await fetchPoll(true);
      } else {
        addToast(data.error || "Failed to record vote", "error");

        // Revert optimistic update on error
        setPoll((prevPoll) => {
          if (!prevPoll) return null;

          return {
            ...prevPoll,
            options: prevPoll.options.map((opt) =>
              opt.id === selectedOption
                ? { ...opt, voteCount: Math.max(0, opt.voteCount - 1) }
                : opt,
            ),
            totalVotes: Math.max(0, prevPoll.totalVotes - 1),
          };
        });

        // If error says already voted, show results
        if (data.error?.includes("already voted")) {
          setHasVoted(true);
          setJustVotedId(selectedOption);
          // Fetch actual poll data
          await fetchPoll(true);
        }
      }
    } catch (error) {
      console.error("Error recording vote:", error);
      addToast("Failed to record vote", "error");

      // Revert optimistic update on error
      setPoll((prevPoll) => {
        if (!prevPoll) return null;

        return {
          ...prevPoll,
          options: prevPoll.options.map((opt) =>
            opt.id === selectedOption
              ? { ...opt, voteCount: Math.max(0, opt.voteCount - 1) }
              : opt,
          ),
          totalVotes: Math.max(0, prevPoll.totalVotes - 1),
        };
      });
    } finally {
      setVoting(false);
    }
  };

  const copyShareUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    addToast("Link copied to clipboard!", "success");
  };

  const handleDeletePoll = async () => {
    if (!visitorId || deleting) return;

    // Confirm before deleting
    const confirmed = confirm(
      "Are you sure you want to delete this poll? This action cannot be undone.",
    );
    if (!confirmed) return;

    setDeleting(true);

    try {
      const response = await fetch(`/api/polls/${pollId}/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: visitorId }),
      });

      const data = await response.json();

      if (response.ok) {
        addToast("Poll deleted successfully", "success");
        // Redirect to home after a short delay
        setTimeout(() => {
          window.location.href = "/";
        }, 1000);
      } else {
        addToast(data.error || "Failed to delete poll", "error");
      }
    } catch (error) {
      console.error("Error deleting poll:", error);
      addToast("Failed to delete poll", "error");
    } finally {
      setDeleting(false);
    }
  };

  if (loading || checkingVote) {
    return (
      <Card className="w-full max-w-2xl mx-auto border-2 shadow-2xl bg-card/50 backdrop-blur overflow-hidden">
        <CardHeader>
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-5 w-1/2 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!poll) {
    return (
      <Card className="w-full max-w-2xl mx-auto border-2 shadow-2xl bg-card/50 backdrop-blur">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="text-6xl mb-4 animate-bounce">😕</div>
          <p className="text-lg text-muted-foreground">Poll not found</p>
        </CardContent>
      </Card>
    );
  }

  const getPercentage = (votes: number) => {
    if (poll.totalVotes === 0) return 0;
    return Math.round((votes / poll.totalVotes) * 100);
  };

  const getWinner = () => {
    if (!poll || poll.totalVotes === 0) return null;
    const maxVotes = Math.max(...poll.options.map((o) => o.voteCount));
    if (maxVotes === 0) return null;
    return poll.options.filter((o) => o.voteCount === maxVotes);
  };

  const winners = getWinner();

  return (
    <Card className="w-full max-w-2xl mx-auto border-2 shadow-2xl bg-card/50 backdrop-blur overflow-hidden animate-scale-in">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
      <CardHeader className="relative">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 space-y-2">
            <CardTitle className="text-3xl leading-tight">
              {poll.question}
            </CardTitle>
            <CardDescription className="text-base flex items-center gap-2">
              <AnimatedNumber value={poll.totalVotes} />{" "}
              {poll.totalVotes === 1 ? "vote" : "votes"} cast
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {poll.creatorId === visitorId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeletePoll}
                disabled={deleting}
                className="shrink-0 hover:bg-destructive/20 hover:border-destructive/50 hover:text-destructive transition-all"
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={copyShareUrl}
              className="shrink-0 hover:bg-primary/10 hover:border-primary/50 transition-all"
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
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              Share
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 relative">
        {poll.options.map((option, index) => {
          const percentage = getPercentage(option.voteCount);
          const isSelected = selectedOption === option.id;
          const isWinner =
            winners &&
            winners.length > 0 &&
            winners.some((w) => w.id === option.id);
          const isJustVoted = justVotedId === option.id;

          return (
            <div key={option.id} className="space-y-2">
              {hasVoted ? (
                <div
                  className={`space-y-3 p-4 rounded-lg border-2 transition-all duration-500 ${
                    isWinner
                      ? "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-amber-500/50 shadow-lg shadow-amber-500/10"
                      : "bg-muted/50 border-border"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-lg font-bold text-base shrink-0 transition-all ${
                          isWinner
                            ? "bg-gradient-to-br from-amber-500 to-yellow-500 text-white scale-110 shadow-lg"
                            : "bg-primary/20 text-primary"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <span className="font-semibold text-lg flex-1">
                        {option.text}
                        {isJustVoted && (
                          <span className="ml-2 text-xs text-primary">
                            ✓ Your vote
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-sm">
                        <AnimatedNumber value={option.voteCount} /> votes
                      </span>
                      <span
                        className={`font-bold text-lg min-w-[4rem] text-right tabular-nums ${
                          isWinner ? "text-amber-500" : "text-primary"
                        }`}
                      >
                        <AnimatedNumber value={percentage} />%
                      </span>
                    </div>
                  </div>
                  <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                    <Progress
                      value={percentage}
                      className={`absolute top-0 left-0 h-full transition-all duration-700 ${
                        isWinner
                          ? "bg-gradient-to-r from-amber-500 to-yellow-500"
                          : ""
                      }`}
                    />
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setSelectedOption(option.id)}
                  className={`w-full p-4 text-left rounded-lg border-2 transition-all duration-200 relative overflow-hidden group ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-xl scale-[1.02]"
                      : "border-border hover:border-primary/50 hover:bg-muted/30 hover:scale-[1.01]"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 pointer-events-none" />
                  )}
                  <div className="flex items-center gap-4 relative">
                    <div
                      className={`flex items-center justify-center w-12 h-12 rounded-xl font-bold text-lg shrink-0 transition-all duration-200 ${
                        isSelected
                          ? "bg-gradient-to-br from-primary to-secondary text-white shadow-lg scale-110"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <span className="flex-1 font-semibold text-lg">
                      {option.text}
                    </span>
                    {isSelected && (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center shadow-lg animate-scale-in">
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent animate-shimmer" />
                  )}
                </button>
              )}
            </div>
          );
        })}

        {!hasVoted && (
          <Button
            onClick={handleVote}
            disabled={!selectedOption || voting}
            className="w-full h-14 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all relative overflow-hidden group mt-6"
            size="lg"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-secondary to-accent opacity-0 group-hover:opacity-20 transition-opacity" />
            <div className="relative flex items-center justify-center">
              {voting ? (
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
                  Recording Vote...
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
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Submit Vote
                </>
              )}
            </div>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
