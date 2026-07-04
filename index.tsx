src/pages/index.tsx [330-344 of 1135] (truncated — use startLine/numLines to read remaining)
330|  if (view === 'landing') {
331|    return (
332|      <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden" dir="rtl"
333|        style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1b3e 50%, #0a0f1e 100%)' }}>
334|        <Helmet>
335|          <title>شات اليمن المطور — منصة الشات العربي</title>
336|          <meta name="description" content="شات اليمن المطور، منصة الشات العربي الأنيق. دخول الزوار والأعضاء، غرف متعددة، رسائل خاصة." />
337|          <link rel="canonical" href="https://mgsb0c5hiw.preview.c35.airoapp.ai/" />
338|        </Helmet>
339|        {/* Background pattern */}
340|        <div className="absolute inset-0 opacity-5" style={{
341|          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 40px, #f0c040 40px, #f0c040 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, #f0c040 40px, #f0c040 41px)`
342|        }} />
343|        {/* Glow orbs */}
344|        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-10 blur-3xl" style={{ background: '#3b82f6' }} />