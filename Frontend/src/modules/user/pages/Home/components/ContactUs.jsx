import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiMail, FiPhone, FiMapPin, FiClock } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

const ContactUs = ({ data }) => {
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (!form.email.trim()) {
      toast.error('Please enter your email');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (!form.message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    toast.success('Your message has been sent successfully!');
    setForm({ name: '', email: '', message: '' });
  };

  if (!data) return null;
  const { title, subtitle, email, phone, address, workingHours } = data;

  return (
    <section id="contact-us" className="py-16 px-6 bg-transparent">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">{title || 'Contact Us'}</h2>
            <p className="text-gray-600 text-lg mb-10">{subtitle}</p>

            <div className="space-y-6">
              {email && (
                <div className="flex items-center gap-6 p-6 rounded-3xl bg-gray-50 border border-gray-100">
                  <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
                    <FiMail className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Email Us</h4>
                    <a href={`mailto:${email}`} className="text-lg font-bold text-gray-900 break-all hover:text-blue-600 hover:underline">{email}</a>
                  </div>
                </div>
              )}
              {phone && (
                <div className="flex items-center gap-6 p-6 rounded-3xl bg-gray-50 border border-gray-100">
                  <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 shrink-0">
                    <FiPhone className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Call Us</h4>
                    <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="text-lg font-bold text-gray-900 hover:text-green-600 hover:underline">{phone}</a>
                  </div>
                </div>
              )}
              {address && (
                <div className="flex items-center gap-6 p-6 rounded-3xl bg-gray-50 border border-gray-100">
                  <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600 shrink-0">
                    <FiMapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Our Office</h4>
                    <p className="text-lg font-bold text-gray-900">{address}</p>
                  </div>
                </div>
              )}
               {workingHours && (
                <div className="flex items-center gap-6 p-6 rounded-3xl bg-gray-50 border border-gray-100">
                  <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 shrink-0">
                    <FiClock className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Working Hours</h4>
                    <p className="text-lg font-bold text-gray-900">{workingHours}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-blue-600 rounded-[40px] p-8 md:p-12 text-white flex flex-col justify-center relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/20 rounded-full -ml-32 -mb-32 blur-3xl"></div>
            
            <h3 className="text-3xl font-black mb-6 relative z-10">Send us a message</h3>
            <p className="text-blue-100 mb-8 relative z-10">Have questions? We're ready to answer any inquiries you might have about our services.</p>
            
            <form className="space-y-4 relative z-10" onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Your Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-6 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-blue-200 outline-none focus:bg-white/20 transition-all"
              />
              <input
                type="email"
                placeholder="Your Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-6 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-blue-200 outline-none focus:bg-white/20 transition-all"
              />
              <textarea
                placeholder="How can we help?"
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full px-6 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-blue-200 outline-none focus:bg-white/20 transition-all resize-none"
              ></textarea>
              <button type="button" onClick={handleSubmit} className="w-full py-4 bg-white text-blue-600 rounded-2xl font-black text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all">Send Message</button>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ContactUs;
