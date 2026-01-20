"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

interface UploadPostProps {
  courseId: string;
  onUploadSuccess?: () => void;
}

export function UploadPost({ courseId, onUploadSuccess }: UploadPostProps) {
  const [postType, setPostType] = useState<"quiz" | "flashcard" | "sticky_note" | "poll">("quiz");
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'error' } | null>(null);
  
  // Quiz state
  const [quizTitle, setQuizTitle] = useState("");
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState(["", "", "", ""]); // Default to 4 options
  const [correctAnswer, setCorrectAnswer] = useState(0);
  
  // Flashcard state
  const [flashcardQuestion, setFlashcardQuestion] = useState("");
  const [flashcardAnswer, setFlashcardAnswer] = useState("");
  
  // Sticky note state
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  
  // Poll state
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  const handleUpload = async () => {
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    try {
      type PostDataType = 
        | { type: "quiz"; title: string; content: { question: string; options: string[]; correct_answer: number } }
        | { type: "flashcard"; content: { question: string; answer: string } }
        | { type: "sticky_note"; title: string; content: string }
        | { type: "poll"; content: { question: string; options: string[] } };
      
      let postData: PostDataType | undefined;

      if (postType === "quiz") {
        const validOptions = quizOptions.filter(opt => opt.trim());
        if (!quizTitle || !quizQuestion || validOptions.length < 2 || validOptions.length > 5) {
          setNotification({ message: "Please fill in title, question, and 2-5 options", type: "error" });
          setUploading(false);
          setTimeout(() => setNotification(null), 3000);
          return;
        }
        // Map correctAnswer index from original array to filtered array
        const validIndices: number[] = [];
        quizOptions.forEach((opt, idx) => {
          if (opt.trim()) {
            validIndices.push(idx);
          }
        });
        const correctAnswerIndex = validIndices.indexOf(correctAnswer);
        if (correctAnswerIndex === -1 || correctAnswer >= quizOptions.length) {
          setNotification({ message: "Please select a valid correct answer", type: "error" });
          setUploading(false);
          setTimeout(() => setNotification(null), 3000);
          return;
        }
        postData = {
          type: "quiz",
          title: quizTitle,
          content: {
            question: quizQuestion,
            options: validOptions,
            correct_answer: correctAnswerIndex,
          },
        };
      } else if (postType === "flashcard") {
        if (!flashcardQuestion || !flashcardAnswer) {
          setNotification({ message: "Please fill in both question and answer", type: "error" });
          setUploading(false);
          setTimeout(() => setNotification(null), 3000);
          return;
        }
        postData = {
          type: "flashcard",
          content: {
            question: flashcardQuestion,
            answer: flashcardAnswer,
          },
        };
      } else if (postType === "sticky_note") {
        if (!noteTitle || !noteContent) {
          setNotification({ message: "Please fill in both title and content", type: "error" });
          setUploading(false);
          setTimeout(() => setNotification(null), 3000);
          return;
        }
        postData = {
          type: "sticky_note",
          title: noteTitle,
          content: noteContent,
        };
      } else if (postType === "poll") {
        const validOptions = pollOptions.filter(opt => opt.trim());
        if (!pollQuestion || validOptions.length < 2 || validOptions.length > 5) {
          setNotification({ message: "Please fill in the question and 2-5 options", type: "error" });
          setUploading(false);
          setTimeout(() => setNotification(null), 3000);
          return;
        }
        postData = {
          type: "poll",
          content: {
            question: pollQuestion,
            options: validOptions,
          },
        };
      }

      const response = await fetch("/api/courses/upload-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseId,
          postData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload post");
      }

      if (!postData) {
        throw new Error("Post data is required");
      }

      // Reset form
      setQuizTitle("");
      setQuizQuestion("");
      setQuizOptions(["", "", "", ""]); // Reset to default 4 options
      setCorrectAnswer(0);
      setFlashcardQuestion("");
      setFlashcardAnswer("");
      setNoteTitle("");
      setNoteContent("");
      setPollQuestion("");
      setPollOptions(["", ""]);

      setUploadSuccess(true);
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error("Error uploading post:", err.message || error);
      setUploadError(err.message || "Failed to upload post. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // Auto-hide success message after 5 seconds
  useEffect(() => {
    if (uploadSuccess) {
      const timer = setTimeout(() => {
        setUploadSuccess(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [uploadSuccess]);

  const getTitle = () => {
    switch (postType) {
      case "quiz":
        return "Upload Quiz";
      case "flashcard":
        return "Upload Flashcard";
      case "sticky_note":
        return "Upload Sticky Note";
      case "poll":
        return "Upload Poll";
      default:
        return "Upload Post";
    }
  };

  const getButtonText = () => {
    switch (postType) {
      case "quiz":
        return "Upload Quiz";
      case "flashcard":
        return "Upload Flashcard";
      case "sticky_note":
        return "Upload Sticky Note";
      case "poll":
        return "Upload Poll";
      default:
        return "Upload Post";
    }
  };

  return (
    <div className="space-y-4">
      {/* Dynamic Title */}
      <h1 className="text-2xl font-bold text-blue-900 mb-6">{getTitle()}</h1>

      {/* Type selector */}
      <div className="flex gap-2 border-b border-blue-200 pb-2">
        <button
          onClick={() => setPostType("quiz")}
          className={`flex-1 text-center px-4 py-2 rounded-lg transition-colors ${
            postType === "quiz"
              ? "bg-blue-100 text-blue-700 font-semibold"
              : "bg-blue-50 text-blue-600 hover:bg-blue-100"
          }`}
        >
          Quiz
        </button>
        <button
          onClick={() => setPostType("flashcard")}
          className={`flex-1 text-center px-4 py-2 rounded-lg transition-colors ${
            postType === "flashcard"
              ? "bg-blue-100 text-blue-700 font-semibold"
              : "bg-blue-50 text-blue-600 hover:bg-blue-100"
          }`}
        >
          Flashcard
        </button>
        <button
          onClick={() => setPostType("sticky_note")}
          className={`flex-1 text-center px-4 py-2 rounded-lg transition-colors ${
            postType === "sticky_note"
              ? "bg-blue-100 text-blue-700 font-semibold"
              : "bg-blue-50 text-blue-600 hover:bg-blue-100"
          }`}
        >
          Sticky Note
        </button>
        <button
          onClick={() => setPostType("poll")}
          className={`flex-1 text-center px-4 py-2 rounded-lg transition-colors ${
            postType === "poll"
              ? "bg-blue-100 text-blue-700 font-semibold"
              : "bg-blue-50 text-blue-600 hover:bg-blue-100"
          }`}
        >
          Poll
        </button>
      </div>

      {/* Form based on type */}
      {postType === "quiz" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-blue-900">Title</label>
            <input
              type="text"
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-blue-900"
              placeholder="Enter quiz title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-blue-900">Question</label>
            <textarea
              value={quizQuestion}
              onChange={(e) => setQuizQuestion(e.target.value)}
              className="w-full px-3 py-2.5 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-blue-900"
              rows={4}
              placeholder="Enter question"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-blue-900">Options (2-5)</label>
            <div className="space-y-2">
              {quizOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={correctAnswer === index}
                    onChange={() => setCorrectAnswer(index)}
                    className="h-4 w-4 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                  />
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...quizOptions];
                      newOptions[index] = e.target.value;
                      setQuizOptions(newOptions);
                    }}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-blue-900 placeholder:text-blue-400 ${
                      correctAnswer === index
                        ? "bg-green-50 border-2 border-green-300"
                        : "bg-white border border-blue-300"
                    }`}
                    placeholder={`Option ${index + 1}`}
                  />
                  {quizOptions.length > 2 && (
                    <button
                      onClick={() => {
                        const newOptions = quizOptions.filter((_, i) => i !== index);
                        setQuizOptions(newOptions);
                        // Adjust correct answer if needed
                        if (correctAnswer >= newOptions.length) {
                          setCorrectAnswer(Math.max(0, newOptions.length - 1));
                        } else if (correctAnswer > index) {
                          setCorrectAnswer(correctAnswer - 1);
                        }
                      }}
                      className="px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {quizOptions.length < 5 && (
                <button
                  onClick={() => setQuizOptions([...quizOptions, ""])}
                  className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border border-blue-300 border-dashed rounded-lg"
                  type="button"
                >
                  + Add Option
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {postType === "flashcard" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-blue-900">Question</label>
            <textarea
              value={flashcardQuestion}
              onChange={(e) => setFlashcardQuestion(e.target.value)}
              className="w-full px-3 py-2.5 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-blue-900"
              rows={4}
              placeholder="Enter question"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-blue-900">Answer</label>
            <textarea
              value={flashcardAnswer}
              onChange={(e) => setFlashcardAnswer(e.target.value)}
              className="w-full px-3 py-2.5 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-blue-900"
              rows={4}
              placeholder="Enter answer"
            />
          </div>
        </div>
      )}

      {postType === "sticky_note" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-blue-900">Title</label>
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-blue-900"
              placeholder="Enter note title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-blue-900">Content</label>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="w-full px-3 py-2.5 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-blue-900"
              rows={6}
              placeholder="Enter note content"
            />
          </div>
        </div>
      )}

      {postType === "poll" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-blue-900">Question</label>
            <textarea
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              className="w-full px-3 py-2.5 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-blue-900"
              rows={4}
              placeholder="Enter poll question"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-blue-900">Options (2-5)</label>
            <div className="space-y-2">
              {pollOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...pollOptions];
                      newOptions[index] = e.target.value;
                      setPollOptions(newOptions);
                    }}
                    className="flex-1 px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-blue-900 placeholder:text-blue-400 bg-white border border-blue-300"
                    placeholder={`Option ${index + 1}`}
                  />
                  {pollOptions.length > 2 && (
                    <button
                      onClick={() => {
                        const newOptions = pollOptions.filter((_, i) => i !== index);
                        setPollOptions(newOptions);
                      }}
                      className="px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 5 && (
                <button
                  onClick={() => setPollOptions([...pollOptions, ""])}
                  className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border border-blue-300 border-dashed rounded-lg"
                  type="button"
                >
                  + Add Option
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <Button
        onClick={handleUpload}
        disabled={uploading}
        className="w-full h-12 text-base font-semibold"
      >
        {uploading ? "Uploading..." : getButtonText()}
      </Button>

      {uploadSuccess && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <Check className="h-4 w-4 text-green-600" />
          <p className="text-sm text-green-600">Post uploaded successfully!</p>
        </div>
      )}

      {uploadError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <X className="h-4 w-4 text-red-600" />
          <p className="text-sm text-red-600">{uploadError}</p>
        </div>
      )}

      {/* In-app notification */}
      {notification && (
        <div className="mt-4 px-4 py-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-300">
          {notification.message}
        </div>
      )}
    </div>
  );
}
