"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CheckCircle2, X, Heart, HeartOff } from "lucide-react";
import { QuizComments } from "./quiz-comments";

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

type CardData = QuizData | StickyNoteData | FlashcardData | OpenQuestionData;

interface Quiz {
  id: string;
  data: CardData;
  course_id: string;
  rating: number;
  final_score?: number;
  is_like?: boolean | null; // true for like, false for dislike, null/undefined for no interaction
}

const SWIPE_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 0.5;

export function CardFeed() {
  const [cards, setCards] = useState<Quiz[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeOffsetY, setSwipeOffsetY] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [swipeHistory, setSwipeHistory] = useState<Array<{ card: Quiz; ratingChange: number; index: number }>>([]);
  const swipeHistoryRef = useRef<Array<{ card: Quiz; ratingChange: number; index: number }>>([]);
  
  // Keep ref in sync with state
  useEffect(() => {
    swipeHistoryRef.current = swipeHistory;
  }, [swipeHistory]);

  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const isDragging = useRef(false);
  const isMouseDown = useRef(false);

  // Carica le card dal database
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
      
      // Call RPC function to get scored quizzes filtered by subscriptions
      // Score calculation: 0.5 * rating + 0.5 * sum(tag scores)
      // Results are automatically ordered by final_score DESC
      let data, error;
      try {
        const result = await supabase.rpc("get_scored_quizzes_with_tags", {
          p_user_id: user.id,
          p_limit: 50,
        });
        data = result.data;
        error = result.error;
        
        // Log the full result for debugging
        console.log("RPC result:", { data: result.data, error: result.error, hasData: !!result.data, hasError: !!result.error });
      } catch (rpcError: any) {
        console.error("RPC call exception:", rpcError);
        console.error("Exception details:", {
          message: rpcError?.message,
          stack: rpcError?.stack,
          name: rpcError?.name,
        });
        error = rpcError;
      }

      if (error) {
        console.error("Error loading cards - full error object:", error);
        console.error("Error type:", typeof error);
        console.error("Error keys:", error ? Object.keys(error) : "error is null/undefined");
        console.error("Error details:", {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
        });
        
        // Try to stringify the error
        try {
          console.error("Error as JSON:", JSON.stringify(error, null, 2));
        } catch (e) {
          console.error("Could not stringify error:", e);
        }
        
        // Check error type
        const isFunctionNotFound = 
          error?.code === "42883" || 
          (error?.message?.includes("does not exist") && !error?.message?.includes("type"));
        
        const isTypeMismatch = 
          error?.code === "42804" ||
          error?.message?.includes("does not match") ||
          error?.message?.includes("type json") ||
          error?.message?.includes("type jsonb");
        
        if (isTypeMismatch) {
          console.error(
            "Type mismatch error in database function. " +
            "The function exists but has a type issue. " +
            "Please run the updated SQL: sql/02_create_get_scored_quizzes_with_tags_function.sql " +
            "Error: " + error?.message
          );
          // Still fall back to direct query
        } else if (isFunctionNotFound) {
          console.warn(
            "Database function 'get_scored_quizzes_with_tags' not found. " +
            "Falling back to direct query (no scoring). " +
            "Run: sql/02_create_get_scored_quizzes_with_tags_function.sql"
          );
        } else {
          console.error(
            "Error calling database function: " + error?.message + 
            " (Code: " + error?.code + "). " +
            "Falling back to direct query (no scoring)."
          );
        }
        
        // Fall back to direct query for any error
        if (isFunctionNotFound || isTypeMismatch || error) {
          
          // Fallback to direct query with subscription filtering
          const { data: subscriptions } = await supabase
            .from("course_subscription")
            .select("course_id")
            .eq("user_id", user.id);

          const subscribedCourseIds = subscriptions?.map((s) => s.course_id) || [];

          if (subscribedCourseIds.length === 0) {
            setCards([]);
            setCurrentIndex(0);
            setIsLoading(false);
            return;
          }

          const { data: fallbackData, error: fallbackError } = await supabase
            .from("quiz")
            .select(`
              id, 
              data, 
              course_id, 
              rating,
              quiz_tag (
                tag (
                  name
                )
              )
            `)
            .in("course_id", subscribedCourseIds)
            .order("id", { ascending: true })
            .limit(20);

          if (fallbackError) {
            console.error("Fallback query error:", fallbackError);
            setIsLoading(false);
            return;
          }

          if (fallbackData) {
            const cardsWithTags = fallbackData.map((quiz: any) => {
              const tags = (quiz.quiz_tag || [])
                .map((qt: any) => qt.tag?.name)
                .filter((name: string | undefined): name is string => !!name);
              
              const cardData = quiz.data as CardData;
              if (tags.length > 0) {
                cardData.suggested_topic_tags = tags;
              }
              
              return {
                id: quiz.id,
                data: cardData,
                course_id: quiz.course_id,
                rating: quiz.rating,
              } as Quiz;
            });
            
            setCards(cardsWithTags);
            setCurrentIndex(0);
            setIsLoading(false);
            return;
          }
        }
        
        setIsLoading(false);
        return;
      }

      if (data) {
        // Map the RPC function response to Quiz interface
        // Tags come as JSONB array from the function
        const cardsWithTags = data.map((quiz: any) => {
          // Extract tag names from the JSONB tags array
          const tags = Array.isArray(quiz.tags)
            ? quiz.tags.map((tag: any) => tag.name).filter((name: string | undefined): name is string => !!name)
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
            rating: quiz.rating,
            final_score: quiz.final_score,
            is_like: quiz.is_like ?? null,
          } as Quiz;
        });
        
        setCards(cardsWithTags);
        setCurrentIndex(0);
      } else {
        // No data returned (user might have no subscriptions or no quizzes)
        setCards([]);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error("Error loading cards:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Update rating in database via API
  const updateRating = useCallback(async (quizId: string, ratingChange: number, isUndo: boolean = false) => {
    try {
      const response = await fetch("/api/quiz/update-rating", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quizId,
          ratingChange,
          isUndo,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Error updating rating:", error);
      }
    } catch (error) {
      console.error("Error updating rating:", error);
    }
  }, []);

  // Gestisce lo swipe
  const handleSwipe = useCallback(
    (direction: "left" | "right") => {
      if (isUpdating || currentIndex >= cards.length || isExiting) return;

      const currentCard = cards[currentIndex];
      if (!currentCard) return;

      setIsExiting(true);
      setIsUpdating(true);

      // Exit animation
      const exitDirection = direction === "right" ? 1000 : -1000;
      setSwipeOffset(exitDirection);

      // Optimistic UI: remove card after a short delay for animation
      const ratingChange = direction === "right" ? 1 : -1;
      const cardToRemove = currentCard;

      // Save to history for undo
      setSwipeHistory((prev) => [...prev, { card: cardToRemove, ratingChange, index: currentIndex }]);

      setTimeout(() => {
        // Rimuovi la card dalla lista
        setCards((prev) => {
          const newCards = [...prev];
          newCards.splice(currentIndex, 1);
          return newCards;
        });

        // Reset stati
        setSwipeOffset(0);
        setSwipeOffsetY(0);
        setIsSwiping(false);
        setSelectedAnswer(null);
        setIsExiting(false);
        setIsFlipped(false);
      }, 300);

      // Update rating in background (doesn't block UI)
      updateRating(cardToRemove.id, ratingChange).finally(() => {
        setIsUpdating(false);
      });
    },
    [currentIndex, cards, isUpdating, isExiting, updateRating]
  );

  // Handle undo (swipe up)
  const handleUndo = useCallback(() => {
    if (swipeHistoryRef.current.length === 0 || isUpdating || isExiting) return;

    const lastSwipe = swipeHistoryRef.current[swipeHistoryRef.current.length - 1];
    if (!lastSwipe) return;

    setIsUpdating(true);

    // Revert the rating change (mark as undo so it removes interaction instead of changing it)
    updateRating(lastSwipe.card.id, -lastSwipe.ratingChange, true).catch((error) => {
      console.error("Error reverting rating:", error);
    });

    // Restore the card to its original position
    setCards((currentCards) => {
      const newCards = [...currentCards];
      newCards.splice(lastSwipe.index, 0, lastSwipe.card);
      
      // Set index immediately after inserting the card
      setTimeout(() => {
        setCurrentIndex(lastSwipe.index);
      }, 10);
      
      return newCards;
    });

    // Remove from history
    setSwipeHistory((prev) => prev.slice(0, -1));

    // Reset states
    setTimeout(() => {
      setSwipeOffset(0);
      setSwipeOffsetY(0);
      setIsSwiping(false);
      setSelectedAnswer(null);
      setIsFlipped(false);
      setIsUpdating(false);
    }, 10);
  }, [isUpdating, isExiting, updateRating]);

  // Touch/Mouse handlers
  const handleStart = useCallback(
    (clientX: number, clientY: number, target: EventTarget | null) => {
      if (isInteracting) return;
      
      // Se è una flashcard, non iniziare lo swipe (permettere il flip)
      if (currentCard?.data.type === "flashcard") {
        return;
      }
      
      // Don't start swipe if clicking on a button or link
      if (
        target instanceof HTMLElement &&
        (target.tagName === "BUTTON" ||
          target.tagName === "A" ||
          target.closest("button") ||
          target.closest("a"))
      ) {
        return;
      }

      startX.current = clientX;
      startY.current = clientY;
      startTime.current = Date.now();
      isDragging.current = false;
      isMouseDown.current = true;
    },
    [isInteracting]
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (isInteracting || !isDragging.current) return;
      const deltaX = clientX - startX.current;
      const deltaY = clientY - startY.current;

      // Prioritize vertical swipe if it's stronger
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
        setIsSwiping(true);
        setSwipeOffsetY(deltaY);
        setSwipeOffset(0);
      } else if (Math.abs(deltaX) > 10) {
        setIsSwiping(true);
        setSwipeOffset(deltaX);
        setSwipeOffsetY(0);
      }
    },
    [isInteracting]
  );

  const handleEnd = useCallback(() => {
    if (isInteracting) return;

    if (isDragging.current) {
      const deltaX = swipeOffset;
      const deltaY = swipeOffsetY;
      const deltaTime = Date.now() - startTime.current;

      // Check for vertical swipe (down) first
      if (Math.abs(deltaY) > SWIPE_THRESHOLD && deltaY > 0 && swipeHistoryRef.current.length > 0) {
        // Swipe down detected - undo last swipe
        handleUndo();
        setSwipeOffset(0);
        setSwipeOffsetY(0);
        setIsSwiping(false);
      } else if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        const velocity = Math.abs(deltaX) / deltaTime;

        if (
          Math.abs(deltaX) > SWIPE_THRESHOLD ||
          velocity > SWIPE_VELOCITY_THRESHOLD
        ) {
          if (deltaX > 0) {
            handleSwipe("right");
          } else {
            handleSwipe("left");
          }
        } else {
          // Reset position
          setSwipeOffset(0);
          setSwipeOffsetY(0);
          setIsSwiping(false);
        }
      } else {
        // Reset position
        setSwipeOffset(0);
        setSwipeOffsetY(0);
        setIsSwiping(false);
      }
    }

    isDragging.current = false;
    isMouseDown.current = false;
  }, [swipeOffset, swipeOffsetY, isInteracting, handleSwipe, handleUndo]);

  // Touch events
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      handleStart(touch.clientX, touch.clientY, e.target);
    },
    [handleStart]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - startX.current);
      const deltaY = Math.abs(touch.clientY - startY.current);
      
      if (!isDragging.current && (deltaX > 10 || deltaY > 10)) {
        isDragging.current = true;
      }
      if (isDragging.current) {
        handleMove(touch.clientX, touch.clientY);
      }
    },
    [handleMove]
  );

  const onTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Mouse events (per desktop)
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      handleStart(e.clientX, e.clientY, e.target);
    },
    [handleStart]
  );

  const onMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Gestisce il mouse move e up globale (quando si muove/rilascia fuori dall'elemento)
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isMouseDown.current) {
        handleEnd();
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isMouseDown.current) {
        const deltaX = Math.abs(e.clientX - startX.current);
        const deltaY = Math.abs(e.clientY - startY.current);
        if (!isDragging.current && (deltaX > 10 || deltaY > 10)) {
          isDragging.current = true;
        }
        if (isDragging.current) {
          handleMove(e.clientX, e.clientY);
        }
      }
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [handleMove, handleEnd]);

  // Handle answer selection for quizzes
  const handleAnswerClick = useCallback(
    (index: number, correctAnswer: number) => {
      if (selectedAnswer !== null) return;

      setIsInteracting(true);
      setSelectedAnswer(index);

      // Allow swipe after a short delay
      setTimeout(() => {
        setIsInteracting(false);
      }, 1000);
    },
    [selectedAnswer]
  );

  const currentCard = cards[currentIndex];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="text-lg font-semibold">No cards available</div>
        <Button onClick={loadCards}>Reload</Button>
      </div>
    );
  }

  const cardData = currentCard.data;
  const rotation = swipeOffset * 0.1;
  const opacity = 1 - Math.abs(swipeOffset) / 300;

  return (
    <div className="flex flex-col items-center justify-center min-h-[600px] px-4 py-8">
      <div
        ref={cardRef}
        className="relative w-full max-w-md"
        style={{
          transform: `translate(${swipeOffset}px, ${swipeOffsetY}px) rotate(${rotation}deg)`,
          opacity: Math.max(opacity, 0.3),
          transition: isSwiping || isExiting ? "none" : "transform 0.3s ease-out, opacity 0.3s ease-out",
          pointerEvents: isExiting ? "none" : "auto",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {cardData.type === "quiz" ? (
        <div className="bg-white rounded-2xl shadow-xl p-6 border-2 border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-bold flex-1">{cardData.title}</h2>
            {currentCard.is_like === true && (
              <Heart className="w-5 h-5 text-red-500 fill-red-500" />
            )}
            {currentCard.is_like === false && (
              <HeartOff className="w-5 h-5 text-gray-500" />
            )}
          </div>
          <div className="mb-6">
            <p className="text-gray-700 mb-4">{cardData.content.question}</p>
            <div className="space-y-2">
              {cardData.content.options.map((option, index) => {
                const isSelected = selectedAnswer === index;
                const isCorrect = index === cardData.content.correct_answer;
                const showResult = selectedAnswer !== null;

                let bgColor = "bg-gray-100 hover:bg-gray-200";
                if (showResult) {
                  if (isCorrect) {
                    bgColor = "bg-green-500 text-white";
                  } else if (isSelected && !isCorrect) {
                    bgColor = "bg-red-500 text-white";
                  }
                }

                return (
                  <button
                    key={index}
                    onClick={() =>
                      handleAnswerClick(index, cardData.content.correct_answer)
                    }
                    disabled={selectedAnswer !== null}
                    className={`w-full text-left p-4 rounded-lg transition-all ${bgColor} ${
                      selectedAnswer === null
                        ? "cursor-pointer active:scale-95"
                        : "cursor-not-allowed"
                    }`}
                  >
                    {option}
                    {showResult && isCorrect && (
                      <CheckCircle2 className="inline-block ml-2 w-5 h-5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comments section */}
          <QuizComments key={currentCard.id} quizId={currentCard.id} />

          <div className="mt-6 pt-4 border-t">
            <Link
              href={`/protected/courses/${currentCard.course_id}`}
              className="text-blue-600 hover:text-blue-800 font-semibold text-sm inline-flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              Go to course →
            </Link>
          </div>
        </div>
      ) : cardData.type === "sticky_note" ? (
        <div
          className="bg-[#FEF08A] rounded-2xl shadow-xl p-6 border-2 border-yellow-300"
          style={{ minHeight: "400px" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-bold flex-1">{cardData.title}</h2>
            {currentCard.is_like === true && (
              <Heart className="w-5 h-5 text-red-500 fill-red-500" />
            )}
            {currentCard.is_like === false && (
              <HeartOff className="w-5 h-5 text-gray-500" />
            )}
          </div>
          <p className="text-gray-800 whitespace-pre-wrap mb-6">
            {cardData.content}
          </p>

          {/* Comments section */}
          <QuizComments key={currentCard.id} quizId={currentCard.id} />

          <div className="mt-6 pt-4 border-t border-yellow-400">
            <Link
              href={`/protected/courses/${currentCard.course_id}`}
              className="text-blue-600 hover:text-blue-800 font-semibold text-sm inline-flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              Go to course →
            </Link>
          </div>
        </div>
      ) : cardData.type === "flashcard" ? (
        <div className="bg-white rounded-2xl shadow-xl p-6 border-2 border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1"></div>
            {currentCard.is_like === true && (
              <Heart className="w-5 h-5 text-red-500 fill-red-500" />
            )}
            {currentCard.is_like === false && (
              <HeartOff className="w-5 h-5 text-gray-500" />
            )}
          </div>
          <div 
            className="cursor-pointer mb-6"
            onClick={(e) => {
              e.stopPropagation();
              setIsFlipped(!isFlipped);
            }}
            style={{ perspective: "1000px", minHeight: "300px" }}
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
                <div className="flex flex-col items-center justify-center py-8">
                  <p className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wide">Question</p>
                  <p className="text-xl text-gray-800 text-center leading-relaxed">{cardData.content.question}</p>
                  <p className="text-xs text-gray-400 mt-6">Click to see the answer</p>
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
                <div className="flex flex-col items-center justify-center py-8">
                  <p className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wide">Answer</p>
                  <p className="text-xl text-gray-800 text-center leading-relaxed">{cardData.content.answer}</p>
                  <p className="text-xs text-gray-400 mt-6">Click to return to the question</p>
                </div>
              </div>
            </div>
          </div>

          {/* Comments section */}
          <QuizComments key={currentCard.id} quizId={currentCard.id} />
          
          <div className="mt-6 pt-4 border-t">
            <Link
              href={`/protected/courses/${currentCard.course_id}`}
              className="text-blue-600 hover:text-blue-800 font-semibold text-sm inline-flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              Go to course →
            </Link>
          </div>
        </div>
      ) : cardData.type === "open_question" ? (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-xl p-6 border-2 border-purple-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1"></div>
            {currentCard.is_like === true && (
              <Heart className="w-5 h-5 text-red-500 fill-red-500" />
            )}
            {currentCard.is_like === false && (
              <HeartOff className="w-5 h-5 text-gray-500" />
            )}
          </div>
          <div className="mb-6">
            <div className="bg-white rounded-lg p-4 mb-4 border border-purple-200">
              <p className="text-lg font-semibold text-gray-800 mb-2">Question:</p>
              <p className="text-gray-700">{cardData.content.question}</p>
            </div>
            <div className="bg-purple-100 rounded-lg p-4 border border-purple-300">
              <p className="text-lg font-semibold text-purple-900 mb-2">Answer:</p>
              <p className="text-purple-800 whitespace-pre-wrap">{cardData.content.answer}</p>
            </div>
          </div>

          {/* Comments section */}
          <QuizComments key={currentCard.id} quizId={currentCard.id} />

          <div className="mt-6 pt-4 border-t border-purple-200">
            <Link
              href={`/protected/courses/${currentCard.course_id}`}
              className="text-blue-600 hover:text-blue-800 font-semibold text-sm inline-flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              Go to course →
            </Link>
          </div>
        </div>
      ) : null}

        {/* Animazione cuore/cuore spezzato durante lo swipe */}
        {isSwiping && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
            {swipeOffset > 50 && (
              <div 
                className="flex flex-col items-center gap-3"
                style={{
                  opacity: Math.min(Math.abs(swipeOffset) / 80, 1),
                  transform: `scale(${0.8 + Math.min(Math.abs(swipeOffset) / 300, 0.7)}) rotate(${Math.min(swipeOffset / 20, 15)}deg)`,
                  transition: "none"
                }}
              >
                <div className="relative">
                  {/* Main heart with pulse animation */}
                  <Heart 
                    className="w-20 h-20 text-red-500 fill-red-500 drop-shadow-2xl"
                    style={{
                      filter: "drop-shadow(0 0 10px rgba(239, 68, 68, 0.5))"
                    }}
                  />
                  {/* External glow effect */}
                  <div className="absolute inset-0 flex items-center justify-center -z-10">
                    <Heart 
                      className="w-28 h-28 text-red-400 fill-red-400 opacity-30"
                      style={{
                        animation: "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite"
                      }}
                    />
                  </div>
                </div>
                <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-2 rounded-full font-bold text-base shadow-lg">
                  LIKE
                </div>
              </div>
            )}
            {swipeOffset < -50 && (
              <div 
                className="flex flex-col items-center gap-3"
                style={{
                  opacity: Math.min(Math.abs(swipeOffset) / 80, 1),
                  transform: `scale(${0.8 + Math.min(Math.abs(swipeOffset) / 300, 0.7)}) rotate(${Math.max(swipeOffset / 20, -15)}deg)`,
                  transition: "none"
                }}
              >
                <div className="relative">
                  {/* Main broken heart */}
                  <HeartOff 
                    className="w-20 h-20 text-gray-700 drop-shadow-2xl"
                    style={{
                      filter: "drop-shadow(0 0 10px rgba(107, 114, 128, 0.5))"
                    }}
                  />
                  {/* External glow effect */}
                  <div className="absolute inset-0 flex items-center justify-center -z-10">
                    <HeartOff 
                      className="w-28 h-28 text-gray-500 opacity-30"
                      style={{
                        animation: "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite"
                      }}
                    />
                  </div>
                </div>
                <div className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-6 py-2 rounded-full font-bold text-base shadow-lg">
                  DISLIKE
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
