"use client";

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Heart, HeartOff, ThumbsDown, Bot, User } from "lucide-react";
import { QuizComments } from "./quiz-comments";
import { formatUsername } from "@/lib/utils";
import { SortMode } from "@/components/feed-sort-filter-controls";

interface QuizData {
  type: "quiz";
  title: string;
  content: {
    question: string;
    options: string[];
    correct_answer: number;
  };
  suggested_topic_tags?: string[];
}

interface StickyNoteData {
  type: "sticky_note";
  title: string;
  content: string;
  suggested_topic_tags?: string[];
}

interface FlashcardData {
  type: "flashcard";
  content: {
    question: string;
    answer: string;
  };
  suggested_topic_tags?: string[];
}

interface OpenQuestionData {
  type: "open_question";
  content: {
    question: string;
    answer: string;
  };
  suggested_topic_tags?: string[];
}

interface PollData {
  type: "poll";
  content: {
    question: string;
    options: string[];
  };
  suggested_topic_tags?: string[];
}

type CardData = QuizData | StickyNoteData | FlashcardData | OpenQuestionData | PollData;

interface Quiz {
  id: string;
  data: CardData;
  course_id: string;
  course_name?: string | null;
  rating: number;
  likes: number;
  dislikes: number;
  created_at: string;
  final_score?: number;
  is_like?: boolean | null; // true for like, false for dislike, null/undefined for no like/dislike (but may have view-time interaction)
  has_interacted?: boolean; // true if user has interacted in any way (like, dislike, or view-time)
  user_id?: string | null; // Author user ID
  author_username?: string | null;
  author_profile_picture_url?: string | null;
  pdf_id?: string | null;
  pdf_owner_id?: string | null; // PDF owner user ID
  pdf_owner_username?: string | null;
  pdf_owner_profile_picture_url?: string | null;
}

interface CardFeedProps {
  courseFilter?: string[] | string | null;
  sortMode?: SortMode;
}

export function CardFeed({ courseFilter = null, sortMode = "algorithm" }: CardFeedProps) {
  const [cards, setCards] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number | null>>({});
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
  const [updatingCards, setUpdatingCards] = useState<Set<string>>(new Set());
  // Poll state: stores vote counts and user vote per poll
  const [pollVotes, setPollVotes] = useState<Record<string, { voteCounts: number[]; totalVotes: number; userVote: number | null; showingResults: boolean }>>({});
  const [updatingPolls, setUpdatingPolls] = useState<Set<string>>(new Set());
  
  // View time tracking
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const viewTimeTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const viewStartTimes = useRef<Map<string, number>>(new Map());
  const viewTimeIncrements = useRef<Map<string, number>>(new Map()); // Track 10-second increments (max 6 = 60s)
  const interactedCardIds = useRef<Set<string>>(new Set());

  // Load cards from database
  const loadCards = useCallback(async () => {
    try {
      const supabase = createClient();
      
      // Get authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error("Error getting user:", userError);
        setIsLoading(false);
        return;
      }

      // Clear existing cards before loading new ones
      setCards([]);
      
      // Apply course filter if specified
      let subscribedCourseIds: string[] = [];
      if (courseFilter) {
        // Handle both array and single string (for backward compatibility)
        subscribedCourseIds = Array.isArray(courseFilter) ? courseFilter : [courseFilter];
      } else {
        // Get user's subscribed courses
        const { data: subscriptions } = await supabase
          .from("course_subscription")
          .select("course_id")
          .eq("user_id", user.id);
        subscribedCourseIds = subscriptions?.map((s) => s.course_id) || [];
      }

      if (subscribedCourseIds.length === 0) {
        setCards([]);
        setIsLoading(false);
        return;
      }
      
      // Call RPC function to get scored quizzes filtered by subscriptions (only if using algorithm sort)
      let data: any[] | null = null;
      let error: any = null;
      
      if (sortMode === "algorithm" || sortMode === undefined) {
        try {
          const result = await supabase.rpc("get_scored_quizzes_with_tags", {
            p_user_id: user.id,
            p_limit: 50,
          });
          data = result.data;
          error = result.error;
        } catch (rpcError: unknown) {
          const err = rpcError as { message?: string; code?: string };
          console.error("RPC call exception:", err.message || rpcError);
          error = rpcError;
        }

        if (error) {
          const err = error as { message?: string; code?: string };
          
          // Check error type
          const isFunctionNotFound = 
            err.code === "42883" || 
            (err.message?.includes("does not exist") && !err.message?.includes("type"));
          
          const isTypeMismatch = 
            err.code === "42804" ||
            err.message?.includes("does not match") ||
            err.message?.includes("type json") ||
            err.message?.includes("type jsonb");
          
          if (isTypeMismatch) {
            console.error("Type mismatch error in database function. Please run: sql/15_update_scoring_with_recency.sql");
          } else if (isFunctionNotFound) {
            console.warn("Database function 'get_scored_quizzes_with_tags' not found. Falling back to direct query.");
          } else {
            console.error("Error calling database function. Falling back to direct query.");
          }
          
          // Fall back to direct query for any error
          data = null;
        } else if (data && (!Array.isArray(data) || data.length === 0)) {
          // If RPC returned successfully but with no data, fall back to direct query
          console.warn("RPC returned no data, falling back to direct query.");
          data = null;
        }
      }

      // If not using algorithm sort, or RPC failed/returned no data/empty array, use direct query
      const shouldUseDirectQuery = sortMode !== "algorithm" || !data || !Array.isArray(data) || (Array.isArray(data) && data.length === 0);
      
      if (shouldUseDirectQuery) {
        let query = supabase
          .from("quiz")
          .select(`
            id, 
            data, 
            course_id, 
            rating,
            likes,
            dislikes,
            created_at,
            user_id,
            pdf_id,
            course:course_id (
              name
            ),
            quiz_tag (
              tag (
                name
              )
            )
          `)
          .in("course_id", subscribedCourseIds);

        // Apply sorting - always by created_at for non-algorithm modes
        query = query.order("created_at", { ascending: false });

        const { data: fallbackData, error: fallbackError } = await query.limit(50);

          if (fallbackError) {
            console.error("Fallback query error:", fallbackError);
            setIsLoading(false);
            return;
          }

          if (fallbackData) {
            // Get user IDs, PDF IDs, and course IDs for lookup
            const userIds = [...new Set(fallbackData.map((q: any) => q.user_id))];
            const pdfIds = [...new Set(fallbackData.map((q: any) => q.pdf_id).filter(Boolean))];
            const courseIds = [...new Set(fallbackData.map((q: any) => q.course_id))];
            
            // Get profiles for authors
            const { data: authorProfiles } = await supabase
              .from("profile")
              .select("id, username, profile_picture_url")
              .in("id", userIds);
            
            // Get course names
            const { data: courses } = await supabase
              .from("course")
              .select("id, name")
              .in("id", courseIds);
            
            const courseMap = new Map((courses || []).map((c: any) => [c.id, c.name]));
            
            // Get PDFs and their owners
            let pdfOwners: Record<string, { owner_id: string; username: string | null; profile_picture_url: string | null }> = {};
            if (pdfIds.length > 0) {
              const { data: pdfs } = await supabase
                .from("course_pdfs")
                .select("id, user_id")
                .in("id", pdfIds);
              
              if (pdfs) {
                const pdfOwnerIds = [...new Set(pdfs.map((p: any) => p.user_id))];
                const { data: pdfOwnerProfiles } = await supabase
                  .from("profile")
                  .select("id, username, profile_picture_url")
                  .in("id", pdfOwnerIds);
                
                if (pdfOwnerProfiles) {
                  const pdfOwnerMap = new Map(pdfOwnerProfiles.map((p: any) => [p.id, { username: p.username, profile_picture_url: p.profile_picture_url }]));
                  pdfs.forEach((pdf: any) => {
                    pdfOwners[pdf.id] = {
                      owner_id: pdf.user_id,
                      username: pdfOwnerMap.get(pdf.user_id)?.username || null,
                      profile_picture_url: pdfOwnerMap.get(pdf.user_id)?.profile_picture_url || null,
                    };
                  });
                }
              }
            }
            
            const authorMap = new Map((authorProfiles || []).map((p: any) => [p.id, { username: p.username, profile_picture_url: p.profile_picture_url }]));
            
            // Get user interactions for all quizzes to determine is_like state and interaction score
            const quizIds = fallbackData.map((q: any) => q.id);
            const { data: userInteractions } = await supabase
              .from("quiz_interaction")
              .select("quiz_id, is_like, interaction_score")
              .eq("user_id", user.id)
              .in("quiz_id", quizIds);
            
            const interactionMap = new Map<string, { is_like: boolean | null; interaction_score: number }>();
            if (userInteractions) {
              userInteractions.forEach((interaction: any) => {
                interactionMap.set(interaction.quiz_id, {
                  is_like: interaction.is_like,
                  interaction_score: interaction.interaction_score || 0,
                });
              });
            }
            
            // Helper to get course name from potentially array or object
            const getCourseName = (course: any, courseMap: Map<string, string>, courseId: string): string | null => {
              if (Array.isArray(course) && course.length > 0) {
                return course[0]?.name || null;
              }
              if (course && typeof course === 'object' && 'name' in course) {
                return course.name || null;
              }
              return courseMap.get(courseId) || null;
            };
            
            let cardsWithTags = fallbackData.map((quiz: any) => {
              const tags = (quiz.quiz_tag || [])
                .map((qt: any) => qt.tag?.name)
                .filter((name: any): name is string => !!name);
              
              const cardData = quiz.data as CardData;
              if (tags.length > 0) {
                cardData.suggested_topic_tags = tags;
              }
              
              const userInteraction = interactionMap.get(quiz.id);
              
              return {
                id: quiz.id,
                data: cardData,
                course_id: quiz.course_id,
                course_name: getCourseName(quiz.course, courseMap, quiz.course_id),
                rating: quiz.rating,
                likes: quiz.likes || 0,
                dislikes: quiz.dislikes || 0,
                created_at: quiz.created_at || new Date().toISOString(),
                is_like: userInteraction?.is_like ?? null,
                has_interacted: userInteraction !== undefined,
                user_interaction_score: userInteraction?.interaction_score ?? 0,
                user_id: quiz.user_id || null,
                author_username: authorMap.get(quiz.user_id)?.username || null,
                author_profile_picture_url: authorMap.get(quiz.user_id)?.profile_picture_url || null,
                pdf_id: quiz.pdf_id || null,
                pdf_owner_id: quiz.pdf_id && pdfOwners[quiz.pdf_id] ? pdfOwners[quiz.pdf_id].owner_id : null,
                pdf_owner_username: quiz.pdf_id && pdfOwners[quiz.pdf_id] ? pdfOwners[quiz.pdf_id].username : null,
                pdf_owner_profile_picture_url: quiz.pdf_id && pdfOwners[quiz.pdf_id] ? pdfOwners[quiz.pdf_id].profile_picture_url : null,
              } as Quiz;
            });
            
            setCards(cardsWithTags);

            // Fetch poll votes for fallback data (similar to RPC path)
            const pollIds = cardsWithTags
              .filter(card => card.data.type === "poll")
              .map(card => card.id);

            if (pollIds.length > 0) {
              const { data: votes, error: votesError } = await supabase
                .from("poll_vote")
                .select("quiz_id, option_index, user_id")
                .in("quiz_id", pollIds);

              if (!votesError && votes) {
                const votesByQuiz = new Map<string, { optionIndex: number; userId: string }[]>();
                votes.forEach(vote => {
                  if (!votesByQuiz.has(vote.quiz_id)) {
                    votesByQuiz.set(vote.quiz_id, []);
                  }
                  votesByQuiz.get(vote.quiz_id)!.push({
                    optionIndex: vote.option_index,
                    userId: vote.user_id,
                  });
                });

                const newPollVotes: Record<string, { voteCounts: number[]; totalVotes: number; userVote: number | null; showingResults: boolean }> = {};
                pollIds.forEach(pollId => {
                  const card = cardsWithTags.find(c => c.id === pollId);
                  if (card && card.data.type === "poll") {
                    const pollVotes = votesByQuiz.get(pollId) || [];
                    const options = card.data.content.options;
                    const voteCounts = options.map((_, index) =>
                      pollVotes.filter(v => v.optionIndex === index).length
                    );
                    const totalVotes = pollVotes.length;
                    const userVote = pollVotes.find(v => v.userId === user.id)?.optionIndex ?? null;

                    newPollVotes[pollId] = {
                      voteCounts,
                      totalVotes,
                      userVote,
                      showingResults: userVote !== null,
                    };
                  }
                });
                setPollVotes(newPollVotes);
              }
            }

            setIsLoading(false);
            return;
          } else {
            // No fallback data, set empty cards
            setCards([]);
            setIsLoading(false);
            return;
          }
        }

      // Process RPC data only if we have valid non-empty data
      if (data && Array.isArray(data) && data.length > 0) {
        // Map the RPC function response to Quiz interface
        interface RPCQuizResponse {
          id: string;
          data: CardData;
          course_id: string;
          course_name?: string | null;
          rating: number;
          likes: number;
          dislikes: number;
          created_at: string;
          final_score?: number;
          is_like?: boolean | null;
          has_interacted?: boolean;
          user_interaction_score?: number;
          tags?: Array<{ name: string; score?: number }>;
          user_id: string;
          author_username?: string | null;
          author_profile_picture_url?: string | null;
          pdf_id?: string | null;
          pdf_owner_id?: string | null;
          pdf_owner_username?: string | null;
          pdf_owner_profile_picture_url?: string | null;
        }
        
        // Get course names for RPC data (if not already included in response)
        const rpcCourseIds = [...new Set(data.map((q: RPCQuizResponse) => q.course_id))];
        const { data: rpcCourses } = await supabase
          .from("course")
          .select("id, name")
          .in("id", rpcCourseIds);
        const rpcCourseMap = new Map((rpcCourses || []).map((c: any) => [c.id, c.name]));
        
        let cardsWithTags = data.map((quiz: RPCQuizResponse) => {
          // Extract tag names from the JSONB tags array
          const tags = Array.isArray(quiz.tags)
            ? quiz.tags.map((tag) => tag.name).filter((name): name is string => !!name)
            : [];
          
          // Add tags back to data for backward compatibility
          const cardData = quiz.data as CardData;
          if (tags.length > 0) {
            cardData.suggested_topic_tags = tags;
          }
          
          return {
            id: quiz.id,
            data: cardData,
            course_id: quiz.course_id,
            course_name: quiz.course_name || rpcCourseMap.get(quiz.course_id) || null,
            rating: quiz.rating,
            likes: quiz.likes || 0,
            dislikes: quiz.dislikes || 0,
            created_at: quiz.created_at || new Date().toISOString(),
            final_score: quiz.final_score,
            is_like: quiz.is_like ?? null,
            has_interacted: quiz.has_interacted ?? false,
            user_interaction_score: quiz.user_interaction_score ?? 0,
            user_id: quiz.user_id || null,
            author_username: quiz.author_username || null,
            author_profile_picture_url: quiz.author_profile_picture_url || null,
            pdf_id: quiz.pdf_id || null,
            pdf_owner_id: quiz.pdf_owner_id || null,
            pdf_owner_username: quiz.pdf_owner_username || null,
            pdf_owner_profile_picture_url: quiz.pdf_owner_profile_picture_url || null,
          } as Quiz;
        });

        // Apply course filter if specified
        if (courseFilter) {
          // Handle both array and single string (for backward compatibility)
          const filterIds = Array.isArray(courseFilter) ? courseFilter : [courseFilter];
          cardsWithTags = cardsWithTags.filter((card) => filterIds.includes(card.course_id));
        }

        // Apply sorting if not using algorithm (already sorted by RPC)
        if (sortMode !== "algorithm") {
          cardsWithTags.sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateB - dateA; // Newest first
          });
        }
        
        setCards(cardsWithTags);

        // Fetch poll votes for all polls
        const pollIds = cardsWithTags
          .filter(card => card.data.type === "poll")
          .map(card => card.id);

        if (pollIds.length > 0) {
          const { data: votes, error: votesError } = await supabase
            .from("poll_vote")
            .select("quiz_id, option_index, user_id")
            .in("quiz_id", pollIds);

          if (!votesError && votes) {
            // Group votes by quiz_id
            const votesByQuiz = new Map<string, { optionIndex: number; userId: string }[]>();
            votes.forEach(vote => {
              if (!votesByQuiz.has(vote.quiz_id)) {
                votesByQuiz.set(vote.quiz_id, []);
              }
              votesByQuiz.get(vote.quiz_id)!.push({
                optionIndex: vote.option_index,
                userId: vote.user_id,
              });
            });

            // Update poll votes state for each poll
            const newPollVotes: Record<string, { voteCounts: number[]; totalVotes: number; userVote: number | null; showingResults: boolean }> = {};
            pollIds.forEach(pollId => {
              const card = cardsWithTags.find(c => c.id === pollId);
              if (card && card.data.type === "poll") {
                const pollVotes = votesByQuiz.get(pollId) || [];
                const options = card.data.content.options;
                const voteCounts = options.map((_, index) =>
                  pollVotes.filter(v => v.optionIndex === index).length
                );
                const totalVotes = pollVotes.length;
                const userVote = pollVotes.find(v => v.userId === user.id)?.optionIndex ?? null;

                newPollVotes[pollId] = {
                  voteCounts,
                  totalVotes,
                  userVote,
                  showingResults: userVote !== null, // Show results if user has voted
                };
              }
            });

            setPollVotes(newPollVotes);
          }
        }
      } else {
        // No data returned (user might have no subscriptions or no quizzes)
        setCards([]);
      }
    } catch (error) {
      console.error("Error loading cards:", error);
    } finally {
      setIsLoading(false);
    }
  }, [courseFilter, sortMode]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Increment user's interaction score for a post (with capping at 10)
  const incrementUserInteractionScore = useCallback(async (quizId: string, increment: number) => {
    try {
      await fetch("/api/quiz/update-user-interaction-score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quizId,
          increment,
        }),
      });
    } catch (error) {
      console.error("Error incrementing user interaction score:", error);
    }
  }, []);

  // Set user's interaction score to a specific value (capped at 10)
  const setUserInteractionScore = useCallback(async (quizId: string, score: number) => {
    try {
      await fetch("/api/quiz/set-user-interaction-score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quizId,
          score,
        }),
      });
    } catch (error) {
      console.error("Error setting user interaction score:", error);
    }
  }, []);

  // Mark a card as interacted (view-time-based)
  const markCardAsInteracted = useCallback(async (quizId: string) => {
    // Don't mark if already interacted
    if (interactedCardIds.current.has(quizId)) {
      return;
    }

    try {
      const response = await fetch("/api/quiz/mark-interaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quizId }),
      });

      if (response.ok) {
        interactedCardIds.current.add(quizId);
      }
    } catch (error) {
      console.error("Error marking card as interacted:", error);
    }
  }, []);

  // Handle toggling off interaction (removing like/dislike)
  const handleInteractionToggle = useCallback(async (quizId: string) => {
    const card = cards.find((c) => c.id === quizId);
    if (!card || card.is_like === null) return;

    setUpdatingCards((prev) => new Set(prev).add(quizId));

    try {
      // Determine the rating change to reverse
      const ratingChange = card.is_like === true ? 1 : -1;
      
      const response = await fetch("/api/quiz/update-rating", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quizId,
          ratingChange: -ratingChange, // Reverse the previous change
          isUndo: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Error updating rating:", error);
        return;
      }

      const result = await response.json();

      // Update local state with new likes/dislikes
      setCards((prev) =>
        prev.map((c) =>
          c.id === quizId 
            ? { 
                ...c, 
                is_like: null,
                likes: result.likes ?? c.likes,
                dislikes: result.dislikes ?? c.dislikes,
              }
            : c
        )
      );
    } catch (error) {
      console.error("Error updating rating:", error);
    } finally {
      setUpdatingCards((prev) => {
        const next = new Set(prev);
        next.delete(quizId);
        return next;
      });
    }
  }, [cards]);

  // Handle like/dislike button clicks
  const handleInteraction = useCallback(async (quizId: string, isLike: boolean) => {
    const card = cards.find((c) => c.id === quizId);
    if (!card) return;

    // Check if already has this exact interaction (clicking same button = toggle off)
    if (card.is_like === (isLike ? true : false)) {
      // Same interaction - remove it (toggle off)
      return handleInteractionToggle(quizId);
    }

    // Different interaction - update it
    setUpdatingCards((prev) => new Set(prev).add(quizId));

    try {
      const ratingChange = isLike ? 1 : -1;
      const response = await fetch("/api/quiz/update-rating", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quizId,
          ratingChange,
          isUndo: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Error updating rating:", error);
        return;
      }

      const result = await response.json();

      // Update local state with new likes/dislikes
      setCards((prev) =>
        prev.map((c) =>
          c.id === quizId
            ? { 
                ...c, 
                is_like: isLike ? true : false,
                likes: result.likes ?? c.likes,
                dislikes: result.dislikes ?? c.dislikes,
              }
            : c
        )
      );
    } catch (error) {
      console.error("Error updating rating:", error);
    } finally {
      setUpdatingCards((prev) => {
        const next = new Set(prev);
        next.delete(quizId);
        return next;
      });
    }
  }, [cards, handleInteractionToggle]);

  // Handle answer selection for quizzes
  const handleAnswerClick = useCallback(async (quizId: string, index: number) => {
    setSelectedAnswers((prev) => {
      const newState = { ...prev, [quizId]: index };
      
      // If this is the first time answering (was null), set score to 10 (max for quiz interaction)
      if (prev[quizId] === null || prev[quizId] === undefined) {
        // Mark as interacted first
        markCardAsInteracted(quizId).then(() => {
          // Set score to 10 (max) for quiz/poll interactions
          setUserInteractionScore(quizId, 10);
        });
      }
      
      return newState;
    });
  }, [incrementUserInteractionScore, markCardAsInteracted]);

  // Handle flashcard flip
  const handleFlip = useCallback(async (quizId: string) => {
    setFlippedCards((prev) => {
      const next = new Set(prev);
      const wasFlipped = next.has(quizId);
      
      if (wasFlipped) {
        next.delete(quizId);
      } else {
        next.add(quizId);
        
        // First flip (flipping to see answer) - increment score by 4 for flashcard flip
        markCardAsInteracted(quizId).then(() => {
          incrementUserInteractionScore(quizId, 4);
        });
      }
      
      return next;
    });
  }, [incrementUserInteractionScore, markCardAsInteracted]);

  // Fetch poll results
  const fetchPollResults = useCallback(async (quizId: string) => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Get all votes for this poll
      const { data: votes, error: votesError } = await supabase
        .from("poll_vote")
        .select("option_index, user_id")
        .eq("quiz_id", quizId);

      if (votesError) {
        console.error("Error fetching poll votes:", votesError);
        return;
      }

      // Get the poll to know how many options (use current cards state or fetch if needed)
      setCards((currentCards) => {
        const card = currentCards.find(c => c.id === quizId);
        if (!card || card.data.type !== "poll") return currentCards;

        const options = card.data.content.options;
        const voteCounts = options.map((_, index) => 
          votes?.filter(v => v.option_index === index).length || 0
        );
        const totalVotes = votes?.length || 0;
        const userVote = votes?.find(v => v.user_id === user.id)?.option_index ?? null;

        setPollVotes((prev) => ({
          ...prev,
          [quizId]: {
            voteCounts,
            totalVotes,
            userVote,
            showingResults: true,
          },
        }));

        return currentCards;
      });
    } catch (error) {
      console.error("Error fetching poll results:", error);
    }
  }, []);

  // Handle poll vote
  const handlePollVote = useCallback(async (quizId: string, optionIndex: number) => {
    setUpdatingPolls((prev) => new Set(prev).add(quizId));

    try {
      const response = await fetch("/api/polls/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quizId,
          optionIndex,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Error voting on poll:", error);
        return;
      }

      const result = await response.json();

      // Mark as interacted and set score to 10 (max) for poll voting
      markCardAsInteracted(quizId).then(() => {
        setUserInteractionScore(quizId, 10);
      });

      // Update poll votes state
      setPollVotes((prev) => ({
        ...prev,
        [quizId]: {
          voteCounts: result.voteCounts,
          totalVotes: result.totalVotes,
          userVote: result.userVote,
          showingResults: true,
        },
      }));
    } catch (error) {
      console.error("Error voting on poll:", error);
    } finally {
      setUpdatingPolls((prev) => {
        const next = new Set(prev);
        next.delete(quizId);
        return next;
      });
    }
  }, [incrementUserInteractionScore, markCardAsInteracted]);

  // Show poll results without voting
  const handleShowPollResults = useCallback((quizId: string) => {
    fetchPollResults(quizId);
  }, [fetchPollResults]);

  // Get author display text
  const getAuthorText = useCallback((card: Quiz): string => {
    if (card.pdf_id && card.pdf_owner_username) {
      return `Created from ${formatUsername(card.pdf_owner_username)}'s notes`;
    }
    if (card.author_username) {
      return `Created by ${formatUsername(card.author_username)}`;
    }
    return "Created by Unknown User";
  }, []);

  // Set up intersection observer for view time tracking
  useEffect(() => {
    if (cards.length === 0) return;

    const observerOptions: IntersectionObserverInit = {
      root: null, // viewport
      rootMargin: "0px",
      threshold: 0.5, // Trigger when 50% of the card is visible
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        const cardId = entry.target.getAttribute("data-card-id");
        if (!cardId) return;

        const viewportHeight = window.innerHeight;
        const cardTop = entry.boundingClientRect.top;
        const cardHeight = entry.boundingClientRect.height;
        const cardCenter = cardTop + cardHeight / 2;
        const viewportCenter = viewportHeight / 2;

        // Check if card center is near viewport center (within 30% of viewport height)
        const distanceFromCenter = Math.abs(cardCenter - viewportCenter);
        const isInCenter = distanceFromCenter < viewportHeight * 0.3;

        if (entry.isIntersecting && isInCenter) {
          // Card is in center - track view time in 10-second increments
          const currentIncrements = viewTimeIncrements.current.get(cardId) || 0;
          
          // Only track if under 10 increments (100 seconds total, or until score caps at 10)
          if (currentIncrements < 10) {
            if (!viewStartTimes.current.has(cardId)) {
              viewStartTimes.current.set(cardId, Date.now());
              
              // Clear any existing timer
              const existingTimer = viewTimeTimers.current.get(cardId);
              if (existingTimer) {
                clearTimeout(existingTimer);
              }

              // Set timer for 10 seconds - increment score and mark as interacted
              const timer = setTimeout(() => {
                const increments = viewTimeIncrements.current.get(cardId) || 0;
                // Cap at 10 increments (100 seconds total) or until score reaches 10
                if (increments < 10) {
                  // Mark as interacted on first increment if not already
                  if (increments === 0) {
                    markCardAsInteracted(cardId);
                  }
                  
                  // Increment user interaction score by 1 (for 10 seconds of viewing)
                  incrementUserInteractionScore(cardId, 1);
                  viewTimeIncrements.current.set(cardId, increments + 1);
                  
                  // Reset start time and timer - observer will naturally restart if card is still in center
                  viewStartTimes.current.delete(cardId);
                  viewTimeTimers.current.delete(cardId);
                } else {
                  // Reached max increments, stop tracking
                  viewStartTimes.current.delete(cardId);
                  viewTimeTimers.current.delete(cardId);
                }
              }, 10000); // 10 seconds

              viewTimeTimers.current.set(cardId, timer);
            }
          }
        } else {
          // Card is not in center - stop tracking current increment
          const startTime = viewStartTimes.current.get(cardId);
          if (startTime) {
            const elapsedTime = Date.now() - startTime;
            
            // If user viewed for 10+ seconds, process the increment
            const increments = viewTimeIncrements.current.get(cardId) || 0;
            if (elapsedTime >= 10000 && increments < 10) {
              if (increments === 0) {
                markCardAsInteracted(cardId);
              }
              incrementUserInteractionScore(cardId, 1);
              viewTimeIncrements.current.set(cardId, increments + 1);
            }
            
            // Clear timer and reset
            const timer = viewTimeTimers.current.get(cardId);
            if (timer) {
              clearTimeout(timer);
              viewTimeTimers.current.delete(cardId);
            }
            viewStartTimes.current.delete(cardId);
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    // Observe all card elements
    cards.forEach((card) => {
      const cardElement = cardRefs.current.get(card.id);
      if (cardElement) {
        observer.observe(cardElement);
      }
    });

    // Cleanup
    return () => {
      observer.disconnect();
      // Clear all timers
      viewTimeTimers.current.forEach((timer) => clearTimeout(timer));
      viewTimeTimers.current.clear();
      viewStartTimes.current.clear();
      // Note: Don't clear viewTimeIncrements - keep track across scrolls
    };
  }, [cards, markCardAsInteracted, incrementUserInteractionScore]);

  // Format relative time (e.g., "2 days ago", "3 weeks ago")
  const formatRelativeTime = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? "minute" : "minutes"} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
    if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
    if (diffWeeks < 4) return `${diffWeeks} ${diffWeeks === 1 ? "week" : "weeks"} ago`;
    if (diffMonths < 12) return `${diffMonths} ${diffMonths === 1 ? "month" : "months"} ago`;
    return `${diffYears} ${diffYears === 1 ? "year" : "years"} ago`;
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="text-lg font-semibold">No cards available</div>
        <Button onClick={loadCards}>Reload</Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-3 py-3 space-y-3">
      {cards.map((card) => {
        const cardData = card.data;
        const selectedAnswer = selectedAnswers[card.id] ?? null;
        const isFlipped = flippedCards.has(card.id);
        const isUpdating = updatingCards.has(card.id);

        // Different styles for different content types - sleek neon accents
        const getCardStyle = () => {
          if (cardData.type === "quiz") {
            return "bg-[hsl(var(--card))] border border-[hsl(200,100%,50%)] overflow-hidden";
          } else if (cardData.type === "poll") {
            return "bg-[hsl(var(--card))] border border-[hsl(0,100%,60%)] overflow-hidden";
          } else if (cardData.type === "sticky_note") {
            return "bg-[hsl(var(--card))] border border-[hsl(60,100%,50%)] overflow-hidden";
          } else if (cardData.type === "flashcard") {
            return "bg-[hsl(var(--card))] border border-[hsl(120,100%,50%)] overflow-hidden";
          } else if (cardData.type === "open_question") {
            return "bg-[hsl(var(--card))] border border-[hsl(var(--border))] overflow-hidden";
          }
          return "bg-[hsl(var(--card))] border border-[hsl(var(--border))] overflow-hidden";
        };

        return (
          <div
            key={card.id}
            ref={(el) => {
              if (el) {
                cardRefs.current.set(card.id, el);
              } else {
                cardRefs.current.delete(card.id);
              }
            }}
            data-card-id={card.id}
            className={getCardStyle()}
          >
            {/* Author Section */}
            <div className={`px-4 pt-2.5 pb-2 border-b ${
              cardData.type === "quiz"
                ? "border-[hsl(200,100%,50%)]"
                : cardData.type === "poll"
                ? "border-[hsl(0,100%,60%)]"
                : cardData.type === "flashcard"
                ? "border-[hsl(120,100%,50%)]"
                : cardData.type === "sticky_note"
                ? "border-[hsl(60,100%,50%)]"
                : "border-[hsl(var(--border))]"
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="relative w-5 h-5 flex-shrink-0">
                    {(card.author_profile_picture_url || card.pdf_owner_profile_picture_url) ? (
                      <>
                        <div className="relative w-5 h-5 rounded-full overflow-hidden border border-[hsl(var(--border))]">
                          <Image
                            src={card.pdf_owner_profile_picture_url || card.author_profile_picture_url || ""}
                            alt="Profile"
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        {card.pdf_id && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] flex items-center justify-center">
                            <Bot className="w-2 h-2 text-[hsl(var(--primary))]" />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="relative w-5 h-5 rounded-full overflow-hidden border border-[hsl(var(--border))] bg-[hsl(var(--muted))] flex items-center justify-center">
                        <User className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
                        {card.pdf_id && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] flex items-center justify-center">
                            <Bot className="w-2 h-2 text-[hsl(var(--primary))]" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                    {card.pdf_id && card.pdf_owner_username ? (
                      <>
                        Created from{" "}
                        <Link 
                          href={`/protected/profile/${card.pdf_owner_id}`}
                          className="hover:opacity-80 transition-opacity underline"
                        >
                          {formatUsername(card.pdf_owner_username)}
                        </Link>
                        's notes
                      </>
                    ) : card.author_username ? (
                      <>
                        Created by{" "}
                        <Link 
                          href={`/protected/profile/${card.user_id}`}
                          className="hover:opacity-80 transition-opacity underline"
                        >
                          {formatUsername(card.author_username)}
                        </Link>
                      </>
                    ) : (
                      "Created by Unknown User"
                    )}
                  </div>
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {formatRelativeTime(card.created_at)}
                </p>
              </div>
              {card.course_name && (
                <Link 
                  href={`/protected/courses/${card.course_id}`}
                  className={`text-xs font-semibold hover:opacity-80 transition-opacity inline-block ${
                    cardData.type === "quiz"
                      ? "text-[hsl(200,100%,50%)]"
                      : cardData.type === "poll"
                      ? "text-[hsl(0,100%,60%)]"
                      : cardData.type === "flashcard"
                      ? "text-[hsl(120,100%,50%)]"
                      : cardData.type === "sticky_note"
                      ? "text-[hsl(60,100%,50%)]"
                      : "text-[hsl(var(--primary))]"
                  }`}
                >
                  {card.course_name}
                </Link>
              )}
            </div>

            {/* Card Content */}
            <div className="p-4">
              {cardData.type === "quiz" ? (
                <div>
                  <h2 className="text-base font-bold text-foreground mb-2.5">
                    {cardData.title}
                  </h2>
                  <div className="mb-3">
                    <p className="text-sm text-foreground/90 mb-2.5">{cardData.content.question}</p>
                    <div className="space-y-2">
                      {cardData.content.options.map((option, index) => {
                        const isSelected = selectedAnswer === index;
                        const isCorrect = index === cardData.content.correct_answer;
                        const showResult = selectedAnswer !== null;

                        let bgColor = "bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--muted))] text-foreground border border-[hsl(var(--border))]";
                        if (showResult) {
                          if (isCorrect) {
                            bgColor = "bg-[hsl(120,100%,50%)] text-[hsl(var(--background))] border-[hsl(120,100%,50%)]";
                          } else if (isSelected && !isCorrect) {
                            bgColor = "bg-[hsl(0,100%,60%)] text-[hsl(var(--background))] border-[hsl(0,100%,60%)]";
                          }
                        }

                        return (
                          <button
                            key={index}
                            onClick={() => handleAnswerClick(card.id, index)}
                            disabled={selectedAnswer !== null}
                            className={`w-full text-left p-2.5 text-sm transition-all ${bgColor} ${
                              selectedAnswer === null
                                ? "cursor-pointer active:opacity-80"
                                : "cursor-not-allowed"
                            }`}
                          >
                            {option}
                            {showResult && isCorrect && (
                              <CheckCircle2 className="inline-block ml-2 h-3.5 w-3.5" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : cardData.type === "sticky_note" ? (
                <div>
                  <h2 className="text-base font-bold text-foreground mb-2.5">
                    {cardData.title}
                  </h2>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {cardData.content}
                  </p>
                </div>
              ) : cardData.type === "flashcard" ? (
                <div
                  className="cursor-pointer"
                  onClick={() => handleFlip(card.id)}
                  style={{ perspective: "1000px", minHeight: "250px" }}
                >
                  <div
                    className="relative w-full transition-transform duration-500"
                    style={{
                      transformStyle: "preserve-3d",
                      transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                    }}
                  >
                    {/* Front - Question */}
                    <div
                      className="backface-hidden"
                      style={{
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                      }}
                    >
                      <div className="flex flex-col items-center justify-center py-5">
                        <p className="text-xs font-semibold text-[hsl(120,100%,50%)] mb-2.5 uppercase tracking-wide">
                          Question
                        </p>
                        <p className="text-sm text-foreground text-center leading-relaxed">
                          {cardData.content.question}
                        </p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-3">Click to see the answer</p>
                      </div>
                    </div>

                    {/* Back - Answer */}
                    <div
                      className="backface-hidden absolute inset-0"
                      style={{
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                      }}
                    >
                      <div className="flex flex-col items-center justify-center py-5">
                        <p className="text-xs font-semibold text-[hsl(120,100%,50%)] mb-2.5 uppercase tracking-wide">
                          Answer
                        </p>
                        <p className="text-sm text-foreground text-center leading-relaxed">
                          {cardData.content.answer}
                        </p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-3">Click to return to the question</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : cardData.type === "open_question" ? (
                <div>
                  <div className="bg-[hsl(var(--secondary))] p-3 mb-3 border border-[hsl(var(--border))]">
                    <p className="text-sm font-semibold text-foreground mb-1.5">Question:</p>
                    <p className="text-foreground/90">{cardData.content.question}</p>
                  </div>
                  <div className="bg-[hsl(var(--muted))] p-3 border border-[hsl(var(--border))]">
                    <p className="text-sm font-semibold text-foreground mb-1.5">Answer:</p>
                    <p className="text-foreground/90 whitespace-pre-wrap">{cardData.content.answer}</p>
                  </div>
                </div>
              ) : cardData.type === "poll" ? (
                <div>
                  <h2 className="text-base font-bold text-foreground mb-2.5">
                    {cardData.content.question}
                  </h2>
                  {(() => {
                    const pollState = pollVotes[card.id];
                    const showingResults = pollState?.showingResults || false;
                    const userVote = pollState?.userVote ?? null;
                    const voteCounts = pollState?.voteCounts || [];
                    const totalVotes = pollState?.totalVotes || 0;
                    const isUpdatingPoll = updatingPolls.has(card.id);

                    return (
                      <>
                        <div className="space-y-2 mb-3">
                          {cardData.content.options.map((option, index) => {
                            const percentage = totalVotes > 0 && showingResults 
                              ? Math.round((voteCounts[index] / totalVotes) * 100)
                              : 0;
                            const isUserVote = userVote === index;
                            const hasVotes = showingResults && voteCounts[index] > 0;

                            return (
                              <div key={index} className="relative">
                                <button
                                  onClick={() => !showingResults && handlePollVote(card.id, index)}
                                  disabled={showingResults || isUpdatingPoll}
                                  className={`w-full text-left p-2.5 transition-all border text-sm ${
                                    showingResults
                                      ? isUserVote
                                        ? "bg-[hsl(0,100%,60%)] border-[hsl(0,100%,60%)] text-[hsl(var(--background))] cursor-default"
                                        : hasVotes
                                        ? "bg-[hsl(var(--secondary))] border-[hsl(0,100%,60%)] text-foreground cursor-default"
                                        : "bg-[hsl(var(--muted))] border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] cursor-default"
                                      : "bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--muted))] text-foreground border-[hsl(var(--border))] cursor-pointer active:opacity-80"
                                  } ${showingResults || isUpdatingPoll ? "cursor-not-allowed" : ""}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{option}</span>
                                    {showingResults && totalVotes > 0 && (
                                      <span className="text-xs font-semibold">
                                        {voteCounts[index]} ({percentage}%)
                                      </span>
                                    )}
                                  </div>
                                  {showingResults && hasVotes && (
                                    <div className="mt-2 h-1 bg-[hsl(var(--secondary))] overflow-hidden">
                                      <div
                                        className={`h-full transition-all ${
                                          isUserVote ? "bg-[hsl(0,100%,60%)]" : "bg-[hsl(0,100%,50%)]"
                                        }`}
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                  )}
                                  {isUserVote && showingResults && (
                                    <span className="absolute top-2 right-2 text-[hsl(0,100%,60%)]">
                                      <CheckCircle2 className="h-4 w-4" />
                                    </span>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        {!showingResults && (
                          <button
                            onClick={() => handleShowPollResults(card.id)}
                            className="text-xs text-[hsl(0,100%,60%)] hover:text-[hsl(0,100%,70%)] underline"
                          >
                            View Results
                          </button>
                        )}
                        {showingResults && (
                          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                            {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : null}

              {/* Like/Dislike Buttons */}
              <div className={`mt-3 pt-2.5 border-t flex items-center gap-3 ${
                cardData.type === "quiz"
                  ? "border-[hsl(200,100%,50%)]"
                  : cardData.type === "poll"
                  ? "border-[hsl(0,100%,60%)]"
                  : cardData.type === "flashcard"
                  ? "border-[hsl(120,100%,50%)]"
                  : cardData.type === "sticky_note"
                  ? "border-[hsl(60,100%,50%)]"
                  : "border-[hsl(var(--border))]"
              }`}>
                <button
                  onClick={() => handleInteraction(card.id, true)}
                  disabled={isUpdating}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors ${
                    card.is_like === true
                      ? "bg-[hsl(120,100%,50%)] text-[hsl(var(--background))] hover:opacity-90"
                      : "bg-[hsl(var(--secondary))] text-foreground hover:bg-[hsl(var(--muted))]"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Heart
                    className={`h-3.5 w-3.5 ${card.is_like === true ? "fill-current" : ""}`}
                  />
                  <span>Like</span>
                </button>
                <button
                  onClick={() => handleInteraction(card.id, false)}
                  disabled={isUpdating}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors ${
                    card.is_like === false
                      ? "bg-[hsl(0,100%,60%)] text-[hsl(var(--background))] hover:opacity-90"
                      : "bg-[hsl(var(--secondary))] text-foreground hover:bg-[hsl(var(--muted))]"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <ThumbsDown
                    className={`h-3.5 w-3.5 ${card.is_like === false ? "fill-current" : ""}`}
                  />
                  <span>Dislike</span>
                </button>
                {(() => {
                  const netLikes = (card.likes || 0) - (card.dislikes || 0);
                  const netLikesColor = netLikes > 0 ? "text-[hsl(120,100%,50%)]" : netLikes < 0 ? "text-[hsl(0,100%,60%)]" : "text-[hsl(var(--muted-foreground))]";
                  return (
                    <span className={`text-xs font-semibold ${netLikesColor}`}>
                      {netLikes > 0 ? "+" : ""}{netLikes}
                    </span>
                  );
                })()}
                {card.is_like !== null && (
                  <button
                    onClick={() => handleInteractionToggle(card.id)}
                    disabled={isUpdating}
                    className="ml-auto text-xs text-[hsl(var(--muted-foreground))] hover:text-foreground underline disabled:opacity-50"
                  >
                    Undo
                  </button>
                )}
              </div>

              {/* Comments Section */}
              <div className="mt-2.5">
                <QuizComments key={card.id} quizId={card.id} />
              </div>

            </div>
          </div>
        );
      })}
    </div>
  );
}
