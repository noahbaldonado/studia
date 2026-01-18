"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, X } from "lucide-react";

interface QuizData {
  type: "quiz";
  title: string;
  content: {
    question: string;
    options: string[];
    correct_answer: number;
  };
}

interface Quiz {
  id: string;
  data: QuizData;
  course_id: string;
  rating: number;
}

const PUZZLE_RUSH_DURATION = 60; // 1 minute in seconds
const MAX_WRONG_ANSWERS = 3;

export function PuzzleRush() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(PUZZLE_RUSH_DURATION);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load quizzes (only quiz type)
  const loadQuizzes = useCallback(async () => {
    try {
      const supabase = createClient();
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error("Error getting user:", userError);
        setIsLoading(false);
        return;
      }

      // Get scored quizzes filtered by subscriptions, but only quiz type
      const result = await supabase.rpc("get_scored_quizzes_with_tags", {
        p_user_id: user.id,
        p_limit: 100, // Get more quizzes for puzzle rush
      });

      if (result.error) {
        console.error("Error loading quizzes:", result.error);
        setIsLoading(false);
        return;
      }

      // Filter to only quiz type
      const quizOnly = (result.data || []).filter((quiz: Quiz) => {
        const data = quiz.data as any;
        return data.type === "quiz";
      });

      setQuizzes(quizOnly);
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading quizzes:", error);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  // Timer countdown
  useEffect(() => {
    if (!isActive || timeRemaining <= 0) {
      if (timeRemaining <= 0 && !isFinished) {
        endGame();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, timeRemaining, isFinished]);

  const startGame = () => {
    setIsActive(true);
    setTimeRemaining(PUZZLE_RUSH_DURATION);
    setCorrectAnswers(0);
    setWrongAnswers(0);
    setCurrentQuizIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setIsFinished(false);
  };

  const endGame = async () => {
    setIsActive(false);
    setIsFinished(true);

    // Save score to profile metadata
    try {
      const response = await fetch("/api/puzzle-rush/save-score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          score: correctAnswers,
        }),
      });

      if (!response.ok) {
        console.error("Error saving puzzle rush score");
      }
    } catch (error) {
      console.error("Error saving puzzle rush score:", error);
    }
  };

  const handleAnswerClick = (index: number, correctAnswer: number) => {
    if (selectedAnswer !== null || !isActive || isFinished) return;

    setSelectedAnswer(index);
    setShowResult(true);

    const isCorrect = index === correctAnswer;

    if (isCorrect) {
      setCorrectAnswers((prev) => prev + 1);
      // Move to next quiz after short delay
      setTimeout(() => {
        nextQuiz();
      }, 500);
    } else {
      const newWrongAnswers = wrongAnswers + 1;
      setWrongAnswers(newWrongAnswers);
      
      if (newWrongAnswers >= MAX_WRONG_ANSWERS) {
        // Game over - max wrong answers reached
        setTimeout(() => {
          endGame();
        }, 1000);
      } else {
        // Move to next quiz after short delay
        setTimeout(() => {
          nextQuiz();
        }, 1000);
      }
    }
  };

  const nextQuiz = () => {
    setCurrentQuizIndex((prev) => {
      if (prev >= quizzes.length - 1) {
        // Shuffle and restart from beginning if we've gone through all quizzes
        return 0;
      }
      return prev + 1;
    });
    setSelectedAnswer(null);
    setShowResult(false);
  };

  const currentQuiz = quizzes[currentQuizIndex];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">Loading quizzes...</div>
      </div>
    );
  }

  if (quizzes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="text-lg font-semibold">No quizzes available</div>
        <Button onClick={loadQuizzes}>Reload</Button>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-6 px-4">
        <div className="text-3xl font-bold">Game Over!</div>
        <div className="text-center">
          <div className="text-2xl font-semibold mb-2">Score: {correctAnswers}</div>
          <div className="text-lg text-zinc-600">
            Wrong Answers: {wrongAnswers}/{MAX_WRONG_ANSWERS}
          </div>
        </div>
        <Button onClick={startGame} className="text-lg px-8 py-6">
          Play Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-[600px] px-4 py-8">
      {/* Header with timer and stats */}
      <div className="w-full max-w-md mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="text-2xl font-bold">Puzzle Rush</div>
          <div className={`text-xl font-bold ${timeRemaining <= 10 ? "text-red-600" : "text-zinc-900"}`}>
            {timeRemaining}s
          </div>
        </div>
        <div className="flex justify-between text-sm text-zinc-600">
          <div>Correct: {correctAnswers}</div>
          <div>Wrong: {wrongAnswers}/{MAX_WRONG_ANSWERS}</div>
        </div>
      </div>

      {/* Quiz card */}
      {currentQuiz && (
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-6 border-2 border-gray-200">
            <h2 className="text-xl font-bold mb-4">{currentQuiz.data.title}</h2>
            <div className="mb-6">
              <p className="text-gray-700 mb-4">{currentQuiz.data.content.question}</p>
              <div className="space-y-2">
                {currentQuiz.data.content.options.map((option, index) => {
                  const isSelected = selectedAnswer === index;
                  const isCorrect = index === currentQuiz.data.content.correct_answer;

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
                        handleAnswerClick(index, currentQuiz.data.content.correct_answer)
                      }
                      disabled={selectedAnswer !== null || !isActive}
                      className={`w-full text-left p-4 rounded-lg transition-all ${bgColor} ${
                        selectedAnswer === null && isActive
                          ? "cursor-pointer active:scale-95"
                          : "cursor-not-allowed opacity-60"
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
          </div>
        </div>
      )}

      {/* Start button if not active */}
      {!isActive && !isFinished && (
        <div className="mt-8">
          <Button onClick={startGame} className="text-lg px-8 py-6">
            Start Puzzle Rush
          </Button>
        </div>
      )}
    </div>
  );
}
