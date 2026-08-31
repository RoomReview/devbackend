import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { H2, H3, Body } from "../components/common/Typography";
import BoroughCard from "../components/common/BoroughCard";
import { Link } from "react-router-dom";
import apiClient from "@/lib/apiClient";


const HomePage = () => {
  const [boroughs, setBoroughs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBoroughs = async () => {
      try {
        const response = await apiClient.get<{ data: any[] }>('/boroughs?page=1&limit=20');
        const items = (response.data.data ?? []).map((borough: any) => ({
          id: borough.boroughId,
          name: borough.name,
          zones: borough.metrics?.zones ?? 'Live data',
          rating: 4.8,
          reviewCount: 0,
          avgRent: borough.metrics?.avgRent ? `£${borough.metrics.avgRent.toLocaleString()}` : '—',
          trend: borough.metrics?.trend ?? 'Updated',
          imageSrc: borough.image ?? 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=400&auto=format&fit=crop',
        }));
        setBoroughs(items);
      } catch {
        setBoroughs([]);
      } finally {
        setLoading(false);
      }
    };

    loadBoroughs();
  }, []);

  const displayedBoroughs = useMemo(() => boroughs.slice(0, 12), [boroughs]);

  return (
    <div className="w-full relative overflow-hidden bg-white font-montserrat">
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-[96px] py-12 lg:py-16">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
          <div className="w-full lg:w-1/2 text-[#0F1724]">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight mb-6">
              Find the best London borough to live, rent, or invest
            </h1>
            
            <p className="text-[#4A5568] text-base leading-relaxed mb-4">
              Explore London boroughs with verified data on housing, safety, transport, and local trends.
            </p>

            <p className="text-[#4A5568] text-base leading-relaxed mb-4">
              <strong className="font-bold text-[#0F1724]">RoomReview</strong> combines official datasets with structured local insights to help you understand what is happening in every neighbourhood — from rent levels and transport access to crime patterns, planning activity, environmental risks, and local voting trends.
            </p>

            <p className="text-[#4A5568] text-base leading-relaxed mb-8">
              Search a borough for a high-level overview or dive deeper into a postcode to access detailed location intelligence and property insights.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <a href="#boroughs" className="inline-flex">
                <button className="bg-[#8B0000] text-white px-6 py-3 rounded-lg font-bold text-sm tracking-wide uppercase hover:bg-[#700000] transition-colors flex items-center gap-2">
                  View Boroughs
                  <span className="text-base leading-none">↓</span>
                </button>
              </a>

              <Link to="/area-search" className="inline-flex">
                <button className="border-2 border-[#8B0000] text-[#8B0000] px-6 py-3 rounded-lg font-bold text-sm tracking-wide uppercase hover:bg-[#8B0000]/5 transition-colors">
                  Search Postcode
                </button>
              </Link>
            </div>
          </div>

          <div className="w-full lg:w-1/2">
            <div className="overflow-hidden rounded-3xl shadow-sm">
              <img
                src="https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1200&auto=format&fit=crop"
                alt="London Aerial View"
                className="w-full h-[360px] sm:h-[440px] lg:h-[480px] object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-[96px] py-16">
        <H2 className="text-center text-[#0b0b0b] mb-16 tracking-[-0.48px] font-bold text-2xl">
          How it works
        </H2>

        <div className="relative">
          <div className="hidden lg:block absolute top-[22.5px] left-[150px] right-[150px] h-[1px] border-t border-dashed border-[#dcd7d7] z-0"></div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 relative z-10">
            {[
              {
                num: 1,
                title: "Browse London boroughs",
                desc: "Get a strategic overview and compare areas across London.",
              },
              {
                num: 2,
                title: "Compare key indicators",
                desc: "Check rent levels, affordability, crime, environmental risks, transport, and local voting trends to see how different areas perform.",
              },
              {
                num: 3,
                title: "Explore local intelligence",
                desc: "Discover planning policies, regeneration projects, infrastructure investments, and political dynamics shaping each borough.",
              },
              {
                num: 4,
                title: "Search a postcode",
                desc: "Look up any UK postcode to unlock detailed neighbourhood intelligence.",
              },
            ].map((step) => (
              <div
                key={step.num}
                className="flex flex-col items-center lg:items-start text-center lg:text-left"
              >
                <div className="w-[45px] h-[45px] rounded-full border border-[#dcd7d7] bg-white flex items-center justify-center text-[#8B0202] font-medium text-2xl mb-8 shadow-sm shrink-0 mx-auto lg:mx-0">
                  {step.num}
                </div>
                <div className="bg-white border border-[#dcd7d7] rounded-[20px] p-6 w-full h-full flex flex-col gap-3 min-h-[224px]">
                  <H3 className="text-[#1A2B3C] text-[24px] font-medium leading-tight">
                    {step.title}
                  </H3>
                  <Body className="text-[#0b0b0b] text-[16px] leading-[1.4]">
                    {step.desc}
                  </Body>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-[96px] py-16">
        <H2 className="text-center text-[#0b0b0b] mb-12 tracking-[-0.72px] text-[36px] font-bold">
          Explore boroughs
        </H2>

        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12 max-w-4xl mx-auto md:max-w-none">
          <div className="w-full md:w-auto md:flex-1 md:max-w-[612px] mx-auto">
            <div className="relative border border-[#dcd7d7] rounded-[10px] shadow-[1px_1px_24.9px_0px_#e9ebed] bg-white flex items-center px-6 py-3 hover:border-gray-300 transition-colors cursor-text">
              <Search className="w-6 h-6 text-[#1A2B3C] shrink-0 mr-3" />
              <input
                type="text"
                placeholder="Search boroughs (e.g. Camden, Hackney)"
                className="w-full text-base text-[#1A2B3C] placeholder:text-[#b7adad] focus:outline-none bg-transparent"
                readOnly
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button className="flex items-center gap-2 hover:opacity-80 transition-opacity font-bold">
              <div className="w-6 h-6 flex items-center justify-center">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3 18H9V16H3V18ZM3 6V8H21V6H3ZM3 13H15V11H3V13Z"
                    fill="#1A2B3C"
                  />
                </svg>
              </div>
              <span className="text-[#0b0b0b] text-base">Sort by:</span>
              <span className="text-[#0b0b0b] text-base font-normal flex items-center gap-1">
                Alphabetical (A → Z)
                <ChevronDown className="w-4 h-4 text-[#0b0b0b]" />
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mb-16 justify-items-center">
          {loading ? (
            <div className="col-span-full text-center text-[#1A2B3C]">Loading borough data...</div>
          ) : displayedBoroughs.length > 0 ? (
            displayedBoroughs.map((borough) => (
              <BoroughCard
                key={borough.id}
                {...borough}
                linkTo={`/borough/${borough.id}`}
              />
            ))
          ) : (
            <div className="col-span-full text-center text-[#1A2B3C]">No borough data available yet.</div>
          )}
        </div>

        <div className="flex justify-center items-center gap-16 mt-8">
          <button
            className="p-2 disabled:opacity-30 transition-opacity"
            disabled
          >
            <ChevronLeft className="w-6 h-6 text-[#8B0202]" />
          </button>
          <div className="flex items-center gap-8">
            <button className="font-bold text-2xl text-[#8B0202]">1</button>
            <button className="font-bold text-2xl text-[#b7adad] hover:text-gray-500 transition-colors">
              2
            </button>
            <button className="font-bold text-2xl text-[#b7adad] hover:text-gray-500 transition-colors">
              3
            </button>
          </div>
          <button className="p-2 hover:opacity-80 transition-opacity">
            <ChevronRight className="w-6 h-6 text-[#8B0202]" />
          </button>
        </div>
      </section>

      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-[96px] py-16 mb-24">
        <div className="bg-[#F3E6DE] rounded-[20px] p-8 lg:p-16 flex flex-col items-start gap-8 max-w-[1250px] mx-auto lg:h-[476px] justify-center relative overflow-hidden">
          <div className="max-w-[612px] flex flex-col gap-6 relative z-10">
            <H2 className="text-[#0b0b0b] text-[36px] font-bold tracking-[-0.72px] leading-tight">
              Explore insights, guides and real tenant stories
            </H2>

            <div className="flex flex-col gap-4 text-[#0b0b0b] text-[16px] leading-[1.4]">
              <p>
                Go beyond the data and understand what living in London is
                really like.
              </p>
              <p>
                Read expert guides, neighbourhood breakdowns, rental tips, and
                real tenant experiences to make smarter decisions.
              </p>
              <p>
                From hidden red flags to local trends — our blog helps you see
                what property listings don't show.
              </p>
            </div>

            <button className="bg-[#8B0202] text-white px-6 py-3 rounded-lg font-bold uppercase tracking-[0.64px] hover:bg-[#691313] transition-colors w-fit">
              Explore the blog
            </button>
          </div>

          <div className="hidden lg:block absolute right-[-50px] top-[-50px] opacity-10 pointer-events-none">
            <div className="w-[300px] h-[300px] rounded-full border-[40px] border-[#8B0202]"></div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
