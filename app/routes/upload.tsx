import { type FormEvent, useState } from 'react';
import Navbar from '~/components/Navbar';
import FileUploader from '~/components/FileUploader';
import { usePuterStore } from '~/lib/puter';
import { useNavigate } from 'react-router';
import { convertPdfToImage } from '~/lib/pdf2image';
import { generateUUID } from '~/lib/utils';
import { prepareInstructions } from '~/../constants/index';
import { AIResponseFormat } from '~/../constants/index';

const upload = () => {
    const { auth, isLoading, fs, ai, kv } = usePuterStore();
    const navigate = useNavigate();
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [file, setFile] = useState<File | null>(null);

    const handleFileSelect = (file: File | null) => {
        setFile(file);
    };

    const handleAnalyse = async (file: File, companyName: string, jobTitle: string, jobDescription: string) => {
        setIsProcessing(true);
        setStatusText('Uploading the file...');
        
        try {
            const uploadedFile = await fs.upload([file]);
            if(!uploadedFile) {
                setStatusText('Failed to upload the file. Please try again.');
                setIsProcessing(false);
                return;
            }

            setStatusText('File uploaded. Converting to image...');
            const conversionResult = await convertPdfToImage(file);
            if(!conversionResult.file || conversionResult.error) {
                setStatusText('Failed to convert PDF to image. Please try again.');
                setIsProcessing(false);
                return;
            }

            setStatusText('PDF converted successfully. Processing...');
            
            const uploadedImage = await fs.upload([conversionResult.file]);
            if(!uploadedImage) {
                setStatusText('Failed to upload the converted image. Please try again.');
                setIsProcessing(false);
                return;
            }

            setStatusText('Image uploaded. Preparing data...');
            const uuid = generateUUID();
            const data = {
                id: uuid,
                resumePath: uploadedFile.path,
                imagePath: uploadedImage.path,
                companyName,
                jobTitle,
                jobDescription,
                feedback: ''
            };

            await kv.set(`resume:${uuid}`, JSON.stringify(data));
            setStatusText('Data saved. Analyzing with AI...');

            const feedback = await ai.feedback(
                uploadedFile.path,
                prepareInstructions({ jobTitle, jobDescription, AIResponseFormat })
            );

            if(!feedback) {
                setStatusText('Failed to get feedback from AI. Please try again.');
                setIsProcessing(false);
                return;
            }

            const feedbackText = typeof feedback.message.content === 'string' ? feedback.message.content : feedback.message.content[0].text;
            data.feedback = JSON.parse(feedbackText);

            await kv.set(`resume:${uuid}`, JSON.stringify(data));
            
            setStatusText('Analysis complete! Redirecting...');
            setIsProcessing(false);
            navigate(`/resume/${uuid}`);
        } catch (error) {
            console.log(error);
            setStatusText('An error occurred during processing. Please try again.');
            setIsProcessing(false);
        }
    };

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const form = e.currentTarget.closest('form');
        if(!form) return;

        const formData = new FormData(form);
        const companyName = formData.get('companyName') as string;
        const jobTitle = formData.get('job-title') as string;
        const jobDescription = formData.get('job-description') as string;

        if(!file) return;
        handleAnalyse(file, companyName, jobTitle, jobDescription);
    };

    return (
        <main className='bg-[url("/images/bg-main.svg")] bg-cover'>
            <Navbar />

            <section className="main-section">
                <div className="page-heading py-16">
                    <h1>Smart feedback for your dream job</h1>
                    {isProcessing ? (
                        <>
                            <h2>{statusText}</h2>
                            <img src="/images/resume-scan.gif" className='w-full' />
                        </>
                    ) : (
                        <h2>Drop your resume for an ATS score and improvement tips</h2>
                    )}
                    {!isProcessing && (
                        <form id="upload-form" onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8">
                            <div className='form-div'>
                                <label htmlFor="company-name">Company Name</label>
                                <input type="text" name="companyName" placeholder="Company Name" id="company-name" />
                            </div>
                            <div className='form-div'>
                                <label htmlFor="job-title">Job Title</label>
                                <input type="text" name="job-title" placeholder="Job Title" id="Job-Title" />
                            </div>
                            <div className='form-div'>
                                <label htmlFor="job-description">Job Description</label>
                                <textarea rows={5} name="job-description" placeholder="Job Description" id="job-description" />
                            </div>
                            <div className='form-div'>
                                <label htmlFor="uploader">Upload Resume</label>
                                <FileUploader onFileSelect={handleFileSelect}/>
                            </div>
                            <button className="primary-button" type="submit">Analyse Resume</button>
                        </form>
                    )}
                </div>
            </section>
        </main>
    )
}

export default upload