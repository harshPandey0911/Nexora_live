import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiPlayCircle, FiList, FiAlertCircle, FiClock } from 'react-icons/fi';
import Logo from '../../../../components/common/Logo';
import { themeColors } from '../../../../theme';
import { toast } from 'react-hot-toast';
import { getActiveTraining } from '../../services/trainingService';
import { register } from '../../services/authService';
import LogoLoader from '../../../../components/common/LogoLoader';
import { useLocation } from 'react-router-dom';

const VendorTraining = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [trainingData, setTrainingData] = useState(null);
  const [step, setStep] = useState('video'); // 'video' | 'mcq' | 'result'
  const [isVideoWatched, setIsVideoWatched] = useState(false);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(45);
  const brandColor = themeColors.brand?.teal || '#347989';

  useEffect(() => {
    const fetchTraining = async () => {
      try {
        setLoading(true);
        const res = await getActiveTraining();
        if (res.success) {
          setTrainingData(res.data);
          if (res.data.videoDuration) {
            setTimeLeft(res.data.videoDuration);
          }
        }
      } catch (error) {
        console.error('Fetch training error:', error);
        toast.error('Failed to load training materials. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetchTraining();
  }, []);

  useEffect(() => {
    let timer;
    if (step === 'video' && !isVideoWatched && trainingData) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, isVideoWatched, trainingData]);

  useEffect(() => {
    if (step === 'video' && timeLeft === 0 && !isVideoWatched && trainingData) {
      setIsVideoWatched(true);
      toast.success('Training completed! You can now start the test.');
    }
  }, [timeLeft, step, isVideoWatched, trainingData]);

  if (loading) return <LogoLoader />;

  if (!trainingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-md">
          <FiAlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-xl font-normal text-gray-900 mb-2">No Training Assigned</h3>
          <p className="text-gray-500 mb-6">Please contact support or try logging in again if you've already completed training.</p>
          <button onClick={() => navigate('/vendor/login')} className="w-full py-3 rounded-xl text-white font-normal" style={{ backgroundColor: brandColor }}>Back to Login</button>
        </div>
      </div>
    );
  }

  const hasPassed = score >= Math.min(trainingData.minimumScore || 3, trainingData.questions.length);

  const handleProceedToTest = () => setStep('mcq');

  const handleOptionSelect = (qId, optionIndex) => {
    setAnswers({ ...answers, [qId]: optionIndex });
  };

  const handleSubmitTest = () => {
    if (Object.keys(answers).length < trainingData.questions.length) {
      toast.error('Please answer all questions before submitting.');
      return;
    }
    let calculatedScore = 0;
    trainingData.questions.forEach((q, index) => {
      if (answers[index] === q.correctOptionIndex) calculatedScore += 1;
    });
    setScore(calculatedScore);
    setStep('result');
  };

  const handleFinish = async () => {
    if (hasPassed) {
      // Logic for registration AFTER training
      const pendingData = location.state?.registerData || JSON.parse(sessionStorage.getItem('pendingVendorRegistration') || 'null');
      
      if (pendingData) {
        try {
          setLoading(true);
          const res = await register({ ...pendingData, trainingScore: score });
          if (res.success) {
            toast.success('Registration Complete! Please wait for admin approval.');
            sessionStorage.removeItem('pendingVendorRegistration');
            navigate('/vendor/login');
          } else {
            // Handle case where backend returns success:false but doesn't throw
            if (res.message?.toLowerCase().includes('already exists')) {
              sessionStorage.removeItem('pendingVendorRegistration');
              navigate('/vendor/login');
            } else {
              toast.error(res.message || 'Registration failed at final step.');
            }
          }
        } catch (error) {
          const errMsg = error.response?.data?.message || '';
          const isDuplicate = errMsg.toLowerCase().includes('already exists') || errMsg.toLowerCase().includes('already registered');
          if (isDuplicate) {
            // If already registered, just let them go to login
            sessionStorage.removeItem('pendingVendorRegistration');
            navigate('/vendor/login');
          } else {
            console.error('Registration finish error:', error);
            const displayMsg = error.response?.data?.message || 'Something went wrong during registration.';
            toast.error(displayMsg);
          }
        } finally {
          setLoading(false);
        }
      } else {
        // Fallback for cases without registration context
        toast.success('Training Completed Successfully!');
        navigate('/vendor/login');
      }
    } else {
      toast.error('You need to score better. Retrying test...');
      setStep('video');
      setIsVideoWatched(false);
      setTimeLeft(trainingData.videoDuration || 45);
      setAnswers({});
      setScore(0);
    }
  };

  // Helper to extract YouTube video ID and make embed URL
  const getEmbedUrl = (url) => {
    if (url.includes('youtube.com/embed/')) return url;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    const videoId = (match && match[2].length === 11) ? match[2] : null;
    return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&disablekb=1&modestbranding=1&rel=0` : url;
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center py-16 px-5">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center mb-12">
        <div className="w-20 h-20 bg-black rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-gray-200">
          <Logo className="h-10 w-auto invert" />
        </div>
        <h2 className="text-sm font-medium text-black capitalize tracking-[0.4em] mb-2">{trainingData.title || 'Partner Training'}</h2>
        <p className="text-[10px] font-medium text-gray-400 capitalize tracking-widest">Onboarding Protocol</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-3xl">
        <div className="bg-white py-10 px-5 shadow-sm sm:rounded-[40px] sm:px-12 border border-gray-100">
          
          <div className="flex items-center justify-center mb-12 border-b border-gray-50 pb-8 text-[9px] font-medium capitalize tracking-[0.2em]">
             <div className={`flex items-center transition-colors ${step === 'video' ? 'text-black' : 'text-gray-300'}`}>
                <FiPlayCircle className="mr-2 w-4 h-4" /> 01. Video Briefing
             </div>
             <div className="w-16 h-[2px] bg-gray-50 mx-6"></div>
             <div className={`flex items-center transition-colors ${step === 'mcq' || step === 'result' ? 'text-black' : 'text-gray-300'}`}>
                <FiList className="mr-2 w-4 h-4" /> 02. Assessment
             </div>
          </div>

          {step === 'video' && (
            <div className="space-y-10 animate-fade-in text-center">
              <div className="bg-black rounded-[32px] aspect-video flex items-center justify-center relative overflow-hidden shadow-2xl shadow-gray-300">
                <iframe 
                  className="w-full h-full"
                  src={getEmbedUrl(trainingData.videoUrl)} 
                  title="Training Video" 
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; compute-pressure" 
                  allowFullScreen
                ></iframe>
                <div className="absolute inset-0 z-10 bg-transparent pointer-events-none"></div>
              </div>
              
              <div className="bg-gray-50 text-black p-6 rounded-[28px] border border-gray-100 flex flex-col items-center justify-center gap-2">
                 <FiClock className={`w-5 h-5 ${!isVideoWatched ? 'animate-pulse' : ''}`} />
                 <span className="text-[10px] font-medium capitalize tracking-[0.2em]">{isVideoWatched ? "Briefing Complete" : `Unlocking Assessment: ${timeLeft}s`}</span>
              </div>

              <button
                onClick={handleProceedToTest}
                disabled={!isVideoWatched}
                className="w-full py-6 px-6 rounded-[32px] text-white font-medium capitalize tracking-[0.3em] transition-all disabled:opacity-20 shadow-2xl shadow-gray-200 active:scale-[0.98] text-xs bg-black"
              >
                {isVideoWatched ? 'Begin Assessment' : `Awaiting Completion`}
              </button>
            </div>
          )}

          {step === 'mcq' && (
            <div className="space-y-8 animate-fade-in">
              {trainingData.questions.map((q, index) => (
                <div key={index} className="bg-gray-50 p-8 rounded-[32px] border border-gray-100 shadow-sm">
                  <h4 className="text-[11px] font-medium text-gray-900 capitalize tracking-widest mb-6 leading-relaxed">
                    <span className="text-gray-300 mr-2">{String(index + 1).padStart(2, '0')}.</span> 
                    {q.question}
                  </h4>
                  <div className="space-y-3">
                    {q.options.map((opt, optIdx) => (
                      <label key={optIdx} className={`flex items-center p-5 rounded-2xl border cursor-pointer transition-all ${answers[index] === optIdx ? 'border-black bg-white shadow-xl shadow-gray-100' : 'border-gray-100 hover:border-gray-300 bg-white'}`}>
                        <input type="radio" name={`q-${index}`} className="w-4 h-4 border-2 border-gray-200 checked:bg-black checked:border-black transition-all accent-black" checked={answers[index] === optIdx} onChange={() => handleOptionSelect(index, optIdx)}/>
                        <span className="ml-4 text-[10px] font-medium capitalize tracking-widest text-gray-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button 
                onClick={handleSubmitTest} 
                className="w-full py-6 rounded-[32px] text-white font-medium capitalize tracking-[0.3em] shadow-2xl shadow-gray-200 bg-black active:scale-95 transition-all text-xs"
              >
                Finalize Submission
              </button>
            </div>
          )}

          {step === 'result' && (
            <div className="text-center py-10 animate-fade-in space-y-8">
              <div className="mx-auto w-24 h-24 rounded-[32px] flex items-center justify-center shadow-xl shadow-gray-100" style={{ backgroundColor: hasPassed ? '#000000' : '#f3f4f6', color: hasPassed ? '#ffffff' : '#9ca3af' }}>
                {hasPassed ? <FiCheckCircle size={40} /> : <FiAlertCircle size={40} />}
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900 capitalize tracking-[0.3em] mb-2">{hasPassed ? 'Credential Verified' : 'Assessment Failed'}</h3>
                <p className="text-[10px] font-medium text-gray-400 capitalize tracking-widest">Accuracy Level: {score} / {trainingData.questions.length}</p>
              </div>
              <button 
                onClick={handleFinish} 
                className="w-full py-6 rounded-[32px] text-white font-medium capitalize tracking-[0.3em] shadow-2xl shadow-gray-200 bg-black active:scale-95 transition-all text-xs"
              >
                {hasPassed ? 'Access Portal' : 'Re-Attempt Briefing'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendorTraining;
